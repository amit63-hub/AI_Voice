// AI Chat Frontend JavaScript
class AIChat {
    constructor() {
        this.apiBaseUrl = 'http://localhost:4000';
        this.userId = this.generateUserId();
        this.messages = [];
        this.isLoading = false;
        this.isVoiceActive = false;
        this.voiceRecognition = null;
        this.chatWindow = null;
        this.chatButton = null;
        this.messageInput = null;
        this.sendButton = null;
        this.voiceButton = null;
        this.messagesContainer = null;
        this.voiceStatus = null;
        this.loadingOverlay = null;
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initVoiceRecognition();
        this.loadConversationHistory();
    }

    cacheElements() {
        this.chatWindow = document.getElementById('chat-window');
        this.chatButton = document.getElementById('chat-button');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.voiceButton = document.getElementById('voice-button');
        this.messagesContainer = document.getElementById('messages-container');
        this.voiceStatus = document.getElementById('voice-status');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.charCount = document.getElementById('char-count');
        this.voiceStatusText = document.getElementById('voice-status-text');
    }

    bindEvents() {
        // Chat button toggle
        this.chatButton.addEventListener('click', () => this.toggleChatWindow());
        
        // Minimize button
        document.getElementById('minimize-chat').addEventListener('click', () => this.minimizeChat());
        
        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Character count
        this.messageInput.addEventListener('input', () => this.updateCharCount());
        
        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => this.autoResizeTextarea());
        
        // Voice button
        this.voiceButton.addEventListener('click', () => this.toggleVoice());
        
        // Close chat on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.chatWindow.classList.contains('active')) {
                this.minimizeChat();
            }
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            if (this.chatWindow.classList.contains('active') &&
                !this.chatWindow.contains(e.target) &&
                !this.chatButton.contains(e.target)) {
                // Don't auto-close, let user control it
            }
        });
    }

    initVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.voiceRecognition = new SpeechRecognition();
            
            this.voiceRecognition.continuous = false;
            this.voiceRecognition.interimResults = false;
            this.voiceRecognition.lang = 'en-US';
            
            this.voiceRecognition.onstart = () => {
                this.setVoiceState('listening');
            };
            
            this.voiceRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.messageInput.value = transcript;
                this.updateCharCount();
                this.autoResizeTextarea();
                this.setVoiceState('processing');
                
                setTimeout(() => {
                    this.setVoiceState('idle');
                    this.sendMessage();
                }, 500);
            };
            
            this.voiceRecognition.onerror = (event) => {
                console.error('Voice recognition error:', event.error);
                this.setVoiceState('idle');
                this.showNotification('Voice recognition failed. Please try again.', 'error');
            };
            
            this.voiceRecognition.onend = () => {
                if (this.isVoiceActive) {
                    this.setVoiceState('idle');
                }
            };
        } else {
            this.voiceButton.style.display = 'none';
        }
    }

    generateUserId() {
        // Check if user ID exists in localStorage
        let userId = localStorage.getItem('ai-chat-user-id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('ai-chat-user-id', userId);
        }
        return userId;
    }

    toggleChatWindow() {
        const isActive = this.chatWindow.classList.contains('active');
        
        if (isActive) {
            this.minimizeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.chatWindow.classList.add('active');
        this.chatButton.classList.add('active');
        this.messageInput.focus();
    }

    minimizeChat() {
        this.chatWindow.classList.remove('active');
        this.chatButton.classList.remove('active');
        this.stopVoice();
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || this.isLoading) return;
        
        // Add user message to UI
        this.addMessage(message, 'user');
        
        // Clear input
        this.messageInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        
        // Show loading
        this.setLoading(true);
        this.showTypingIndicator();
        
        try {
            // Send to API
            const response = await fetch(`${this.apiBaseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    message: message
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide typing indicator
            this.hideTypingIndicator();
            
            // Add AI response
            this.addMessage(data.response, 'ai');
            
            // Save to localStorage
            this.saveConversationHistory();
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'ai');
            this.showNotification('Failed to send message. Please check your connection.', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    addMessage(content, sender) {
        const message = {
            id: Date.now(),
            content: content,
            sender: sender,
            timestamp: new Date().toISOString()
        };
        
        this.messages.push(message);
        
        // Create message element
        const messageElement = this.createMessageElement(message);
        this.messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (message.sender === 'user') {
            avatar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
            `;
        } else {
            avatar.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
                </svg>
            `;
        }
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const paragraph = document.createElement('p');
        paragraph.textContent = message.content;
        content.appendChild(paragraph);
        
        const time = document.createElement('div');
        time.className = 'message-time';
        time.textContent = this.formatTime(message.timestamp);
        content.appendChild(time);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        return messageDiv;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing-message';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"></path>
                </svg>
            </div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingMessage = this.messagesContainer.querySelector('.typing-message');
        if (typingMessage) {
            typingMessage.remove();
        }
    }

    toggleVoice() {
        if (this.isVoiceActive) {
            this.stopVoice();
        } else {
            this.startVoice();
        }
    }

    startVoice() {
        if (!this.voiceRecognition) {
            this.showNotification('Voice recognition is not supported in your browser.', 'error');
            return;
        }
        
        try {
            this.voiceRecognition.start();
            this.isVoiceActive = true;
            this.voiceButton.classList.add('active');
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.showNotification('Failed to start voice recognition.', 'error');
        }
    }

    stopVoice() {
        if (this.voiceRecognition && this.isVoiceActive) {
            this.voiceRecognition.stop();
        }
        this.isVoiceActive = false;
        this.voiceButton.classList.remove('active');
        this.setVoiceState('idle');
    }

    setVoiceState(state) {
        this.voiceStatus.className = 'voice-status';
        
        switch (state) {
            case 'listening':
                this.voiceStatus.classList.add('listening');
                this.voiceStatusText.textContent = 'Listening...';
                break;
            case 'processing':
                this.voiceStatus.classList.add('processing');
                this.voiceStatusText.textContent = 'Processing...';
                break;
            case 'speaking':
                this.voiceStatus.classList.add('speaking');
                this.voiceStatusText.textContent = 'Speaking...';
                break;
            case 'idle':
            default:
                this.voiceStatus.classList.add('hidden');
                break;
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.sendButton.disabled = loading;
        
        if (loading) {
            this.loadingOverlay.classList.add('active');
        } else {
            this.loadingOverlay.classList.remove('active');
        }
    }

    updateCharCount() {
        const length = this.messageInput.value.length;
        this.charCount.textContent = length;
        
        if (length > 900) {
            this.charCount.style.color = 'var(--error-color)';
        } else if (length > 700) {
            this.charCount.style.color = 'var(--warning-color)';
        } else {
            this.charCount.style.color = 'var(--text-light)';
        }
    }

    autoResizeTextarea() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 64) + 'px';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            background: type === 'error' ? 'var(--error-color)' : 'var(--primary-color)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: '3000',
            maxWidth: '300px',
            fontSize: '0.875rem',
            animation: 'slideInRight 0.3s ease-out'
        });
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    saveConversationHistory() {
        const history = {
            userId: this.userId,
            messages: this.messages.slice(-50), // Keep last 50 messages
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('ai-chat-history', JSON.stringify(history));
    }

    loadConversationHistory() {
        const saved = localStorage.getItem('ai-chat-history');
        if (saved) {
            try {
                const history = JSON.parse(saved);
                if (history.userId === this.userId && history.messages) {
                    this.messages = history.messages;
                    
                    // Clear welcome message
                    const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
                    if (welcomeMessage) {
                        welcomeMessage.remove();
                    }
                    
                    // Load messages
                    history.messages.forEach(message => {
                        const messageElement = this.createMessageElement(message);
                        this.messagesContainer.appendChild(messageElement);
                    });
                    
                    this.scrollToBottom();
                }
            } catch (error) {
                console.error('Error loading conversation history:', error);
            }
        }
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AIChat();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIChat;
}
