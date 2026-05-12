class VoiceClient {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.settings = {
      language: 'en',
      voice: 'alloy',
      speed: 1.0,
      pitch: 1.0
    };
    
    this.callbacks = {
      onTranscription: null,
      onResponse: null,
      onListeningStart: null,
      onListeningStop: null,
      onSpeakingStart: null,
      onSpeakingStop: null,
      onError: null,
      onConnect: null,
      onDisconnect: null
    };
  }

  async connect(userId = null) {
    try {
      const wsUrl = `ws://localhost:4001?userId=${userId || 'anonymous'}`;
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Voice client connected');
        if (this.callbacks.onConnect) this.callbacks.onConnect();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
      
      this.ws.onclose = () => {
        console.log('Voice client disconnected');
        if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.callbacks.onError) this.callbacks.onError(error);
      };
      
      // Initialize audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
    } catch (error) {
      console.error('Failed to connect voice client:', error);
      if (this.callbacks.onError) this.callbacks.onError(error);
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'welcome':
        this.sessionId = message.sessionId;
        console.log('Voice session established:', this.sessionId);
        break;
        
      case 'listening_started':
        this.isListening = true;
        if (this.callbacks.onListeningStart) {
          this.callbacks.onListeningStart(message.message);
        }
        break;
        
      case 'listening_stopped':
        this.isListening = false;
        if (this.callbacks.onListeningStop) {
          this.callbacks.onListeningStop(message.message);
        }
        break;
        
      case 'transcription':
        if (this.callbacks.onTranscription) {
          this.callbacks.onTranscription(message.text, message.confidence);
        }
        break;
        
      case 'processing':
        console.log('Processing voice input...');
        break;
        
      case 'speaking_started':
        this.isSpeaking = true;
        if (this.callbacks.onSpeakingStart) {
          this.callbacks.onSpeakingStart(message.text);
        }
        break;
        
      case 'audio_chunk':
        this.playAudioChunk(message.audioData, message.isFinal);
        break;
        
      case 'speaking_finished':
        this.isSpeaking = false;
        if (this.callbacks.onSpeakingStop) {
          this.callbacks.onSpeakingStop(message.message);
        }
        break;
        
      case 'speech_interrupted':
        this.isSpeaking = false;
        this.stopAudio();
        if (this.callbacks.onSpeakingStop) {
          this.callbacks.onSpeakingStop(message.message);
        }
        break;
        
      case 'vad_status':
        // Handle voice activity detection
        this.updateVADStatus(message.isSpeaking, message.energy);
        break;
        
      case 'settings_updated':
        this.settings = { ...this.settings, ...message.settings };
        break;
        
      case 'error':
        console.error('Voice server error:', message.message);
        if (this.callbacks.onError) {
          this.callbacks.onError(new Error(message.message));
        }
        break;
        
      case 'pong':
        // Heartbeat response
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  async startListening() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Voice client not connected');
    }
    
    if (this.isListening) return;
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      
      // Setup media recorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.sendAudioData(audioBlob);
          this.audioChunks = [];
        }
      };
      
      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      
      // Tell server to start listening
      this.sendMessage({ type: 'start_listening' });
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    }
  }

  stopListening() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      
      // Stop all tracks
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    // Tell server to stop listening
    this.sendMessage({ type: 'stop_listening' });
  }

  async sendAudioData(audioBlob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1];
        this.sendMessage({
          type: 'audio_data',
          audioData: base64Data
        });
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error sending audio data:', error);
    }
  }

  interrupt() {
    if (this.isSpeaking) {
      this.sendMessage({ type: 'interrupt' });
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.sendMessage({
      type: 'update_settings',
      settings: newSettings
    });
  }

  async playAudioChunk(base64AudioData, isFinal) {
    try {
      const audioData = atob(base64AudioData);
      const uint8Array = new Uint8Array(audioData.length);
      
      for (let i = 0; i < audioData.length; i++) {
        uint8Array[i] = audioData.charCodeAt(i);
      }
      
      // Decode and play audio
      const audioBuffer = await this.audioContext.decodeAudioData(uint8Array.buffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      
      source.connect(this.audioContext.destination);
      source.start();
      
      if (isFinal) {
        source.onended = () => {
          // Audio finished playing
        };
      }
    } catch (error) {
      console.error('Error playing audio chunk:', error);
    }
  }

  stopAudio() {
    if (this.audioContext) {
      this.audioContext.close().then(() => {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      });
    }
  }

  updateVADStatus(isSpeaking, energy) {
    // Update UI with VAD status
    const vadIndicator = document.querySelector('.vad-indicator');
    if (vadIndicator) {
      vadIndicator.style.opacity = isSpeaking ? '1' : '0.3';
      vadIndicator.style.transform = `scale(${0.5 + energy * 0.5})`;
    }
  }

  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }

  // Event listener methods
  onTranscription(callback) {
    this.callbacks.onTranscription = callback;
  }

  onResponse(callback) {
    this.callbacks.onResponse = callback;
  }

  onListeningStart(callback) {
    this.callbacks.onListeningStart = callback;
  }

  onListeningStop(callback) {
    this.callbacks.onListeningStop = callback;
  }

  onSpeakingStart(callback) {
    this.callbacks.onSpeakingStart = callback;
  }

  onSpeakingStop(callback) {
    this.callbacks.onSpeakingStop = callback;
  }

  onError(callback) {
    this.callbacks.onError = callback;
  }

  onConnect(callback) {
    this.callbacks.onConnect = callback;
  }

  onDisconnect(callback) {
    this.callbacks.onDisconnect = callback;
  }

  // Utility methods
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getSessionId() {
    return this.sessionId;
  }

  getCurrentState() {
    return {
      isConnected: this.isConnected(),
      sessionId: this.sessionId,
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      settings: this.settings
    };
  }
}

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceClient;
}
