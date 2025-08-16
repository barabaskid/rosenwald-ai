import React, { useState, useEffect, useRef } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator
} from '@chatscope/chat-ui-kit-react';

import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';

// --- Session ID Generator ---
const getSessionId = () => {
    let id = sessionStorage.getItem('sessionId');
    if (!id) {
        id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('sessionId', id);
    }
    return id;
};

// --- Web Audio Player for Streaming ---
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioSource;

async function playAudioStream(stream) {
    if (audioSource) {
        audioSource.stop();
    }
    const audioData = await stream.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(audioData);
    audioSource = audioContext.createBufferSource();
    audioSource.buffer = buffer;
    audioSource.connect(audioContext.destination);
    audioSource.start(0);
}


function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [sessionId] = useState(getSessionId());
  const messagesEndRef = useRef(null);
  
  // ... (Speech recognition hooks and effects remain the same)

  const handleStart = async () => {
    setIsStarted(true);
    setIsTyping(true);
    try {
        const response = await fetch(`${BACKEND_URL}/greeting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionId })
        });
        const data = await response.json();
        const welcomeMessage = { message: data.text, sender: "Arby", direction: "incoming" };
        setMessages([welcomeMessage]);
        const audio = new Audio(`${BACKEND_URL}${data.audioUrl}`);
        audio.play().catch(err => console.error("Audio playback failed:", err));
    } catch (error) {
        console.error("Failed to fetch welcome message:", error);
    } finally {
        setIsTyping(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (newMessage) => {
    // ... (logic to add user message remains the same)
    
    setIsTyping(true);
    try {
        const response = await fetch(`${BACKEND_URL}/chat-stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newMessage, sessionId: sessionId })
        });
        
        const textResponse = decodeURIComponent(response.headers.get('X-Text-Response'));
        
        const arbyMessage = { message: textResponse, sender: "Arby", direction: "incoming" };
        setMessages(prevMessages => [...prevMessages, arbyMessage]);

        // Play the audio stream
        await playAudioStream(response.body);

    } catch (error) {
        console.error("Error fetching AI response:", error);
    } finally {
        setIsTyping(false);
    }
  };
  
  // ... (handleVoiceButtonClick and browser support check remain the same)
  
  // ... (The entire return statement with your JSX remains the same)
}

export default App;