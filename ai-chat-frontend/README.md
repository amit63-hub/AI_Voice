# AI Chat Frontend

A modern, responsive AI chat interface with voice support built with vanilla JavaScript, HTML, and CSS.

## Features

### Chat Interface
- **Floating Chat Button**: Expandable chat window with smooth animations
- **Message History**: Persistent conversation storage in localStorage
- **Typing Indicators**: Visual feedback when AI is processing
- **Auto-scroll**: Automatically scrolls to latest messages
- **Character Counter**: Real-time character count for messages

### Voice Support
- **Voice Input**: Web Speech API integration for speech-to-text
- **Voice States**: Visual indicators for listening, processing, and speaking
- **Microphone Controls**: Easy toggle for voice input

### User Experience
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Modern UI**: Clean, professional interface with smooth transitions
- **Accessibility**: ARIA labels, keyboard navigation, focus states
- **Dark Mode**: Automatic dark mode support
- **Error Handling**: Graceful error handling with user notifications

## Quick Start

1. **Open the application**:
   ```bash
   # Simply open index.html in your browser
   # Or serve with a local server
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

2. **Ensure backend is running**:
   - Make sure the AI backend is running on `http://localhost:4000`
   - Update `apiBaseUrl` in `script.js` if using a different endpoint

3. **Start chatting**:
   - Click the floating chat button to open the chat window
   - Type messages or use voice input
   - Press Enter or click Send to send messages

## API Integration

The frontend connects to the following backend endpoints:

### POST /chat
```javascript
const response = await fetch(`${apiBaseUrl}/chat`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        userId: 'user_123',
        message: 'Hello, AI!'
    })
});
```

## File Structure

```
ai-chat-frontend/
    index.html          # Main HTML structure
    styles.css          # Complete CSS styling
    script.js           # JavaScript functionality
    README.md           # Documentation
```

## Components

### Chat Window
- **Header**: AI assistant info with online status
- **Messages Container**: Scrollable message history
- **Input Area**: Text input with voice and send controls
- **Voice Status**: Visual feedback for voice operations

### Message Types
- **User Messages**: Right-aligned with user avatar
- **AI Messages**: Left-aligned with AI avatar
- **Typing Indicator**: Animated dots during AI processing

### Voice States
- **Idle**: Voice input not active
- **Listening**: Capturing user speech
- **Processing**: Converting speech to text
- **Speaking**: AI response (future feature)

## Styling

### CSS Variables
Customizable theme using CSS variables:
```css
:root {
    --primary-color: #6366f1;
    --text-primary: #1f2937;
    --bg-primary: #ffffff;
    /* ... more variables */
}
```

### Responsive Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

## JavaScript Architecture

### Main Class: AIChat
```javascript
class AIChat {
    constructor() {
        this.apiBaseUrl = 'http://localhost:4000';
        this.userId = this.generateUserId();
        this.messages = [];
        // ... initialization
    }
}
```

### Key Methods
- `sendMessage()`: Send message to AI backend
- `addMessage()`: Add message to UI
- `toggleVoice()`: Control voice input
- `saveConversationHistory()`: Persist messages
- `loadConversationHistory()`: Restore previous conversations

## Browser Support

### Required Features
- **ES6 Classes**: Modern JavaScript
- **Fetch API**: HTTP requests
- **LocalStorage**: Data persistence
- **CSS Grid/Flexbox**: Layout
- **CSS Variables**: Theming

### Optional Features
- **Web Speech API**: Voice input (falls back gracefully)
- **CSS Custom Properties**: Enhanced theming

## Performance

### Optimizations
- **Event Delegation**: Efficient event handling
- **Lazy Loading**: Load history only when needed
- **Debounced Input**: Smooth textarea resizing
- **CSS Animations**: Hardware-accelerated transitions

### Memory Management
- **Message Limits**: Keep only last 50 messages
- **Event Cleanup**: Proper event listener management
- **DOM Recycling**: Efficient message rendering

## Security

### Considerations
- **XSS Prevention**: Safe HTML content rendering
- **CSRF Protection**: Same-origin requests
- **Data Validation**: Input sanitization
- **Secure Storage**: Sensitive data handling

## Customization

### Theming
Update CSS variables for custom colors:
```css
:root {
    --primary-color: #your-brand-color;
    --secondary-color: #your-accent-color;
}
```

### API Configuration
Modify the API endpoint:
```javascript
this.apiBaseUrl = 'https://your-api-domain.com';
```

### Branding
Update the hero section and chat header:
```html
<h1>Your Brand Name</h1>
<p>Your tagline</p>
```

## Troubleshooting

### Common Issues

**Voice not working?**
- Check browser compatibility (Chrome/Edge recommended)
- Ensure HTTPS for production environments
- Verify microphone permissions

**Messages not sending?**
- Confirm backend is running on correct port
- Check browser console for errors
- Verify API endpoint configuration

**Styling issues?**
- Clear browser cache
- Check CSS variable support
- Verify responsive breakpoints

### Debug Mode
Enable console logging:
```javascript
// In script.js, add debug logs
console.log('Debug info:', data);
```

## Future Enhancements

### Planned Features
- **File Upload**: Share images/documents
- **Emoji Support**: Rich text messaging
- **Message Reactions**: Interactive responses
- **Multi-language**: Internationalization
- **Push Notifications**: Message alerts

### Voice Improvements
- **Text-to-Speech**: AI voice responses
- **Voice Commands**: Control by voice
- **Audio Playback**: Message audio
- **Noise Cancellation**: Better voice quality

## License

MIT License - feel free to use and modify for your projects.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

Built with vanilla JavaScript, HTML5, and CSS3 - no frameworks required!
