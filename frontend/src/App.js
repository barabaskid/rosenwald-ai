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

function App() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const messagesEndRef = useRef(null);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();
  
  const hasTranscriptStarted = useRef(false);

  useEffect(() => {
    if (transcript) {
      hasTranscriptStarted.current = true;
    }
    
    if (!listening && hasTranscriptStarted.current && transcript.trim() !== "") {
      handleSend(transcript);
      hasTranscriptStarted.current = false;
    }
  }, [listening, transcript]);


  const handleStart = async () => {
    setIsStarted(true);
    setIsTyping(true);

    try {
        const response = await fetch(`${BACKEND_URL}/greeting`, { method: 'POST' });
        const data = await response.json();

        const welcomeMessage = {
            message: data.text,
            sender: "Arby",
            direction: "incoming",
        };
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
    resetTranscript();
    const newUserMessage = {
      message: newMessage,
      sender: "user",
      direction: "outgoing"
    };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    setIsTyping(true);

    try {
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage })
      });
      const data = await response.json();
      const arbyMessage = {
        message: data.text,
        sender: "Arby",
        direction: "incoming"
      };
      setMessages(prevMessages => [...prevMessages, arbyMessage]);
      try {
        const audio = new Audio(`${BACKEND_URL}${data.audioUrl}`);
        await audio.play();
      } catch (err) {
        console.error("Audio playback failed:", err);
      }
    } catch (error) {
      console.error("Error fetching AI response:", error);
    } finally {
      setIsTyping(false);
    }
  };
  
  const handleVoiceButtonClick = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      hasTranscriptStarted.current = false;
      SpeechRecognition.startListening({ continuous: false });
    }
  };

  if (!browserSupportsSpeechRecognition) {
    return <div className="app"><span>Browser doesn't support speech recognition.</span></div>;
  }

  return (
    <div className="app-wrapper">
      {!isStarted && (
        <div className="start-container">
          <button className="start-button" onClick={handleStart}>Start</button>
          {/* --- NEW: Instructional text --- */}
          <p className="start-info">(Upon start allow a few seconds for the program to begin)</p>
        </div>
      )}
      <div className={`app ${!isStarted ? 'blurred' : ''}`}>
        <h1>Now Chatting</h1>
        <MainContainer>
          <ChatContainer>
            <MessageList 
              typingIndicator={isTyping ? <TypingIndicator content="Arby is thinking..." /> : null}
            >
              {messages.map((msg, index) => (
                <Message
                  key={index}
                  model={{
                    message: msg.message,
                    sender: msg.sender,
                    direction: msg.direction,
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </MessageList>
            <MessageInput 
              placeholder={listening ? "Listening..." : "Type your message here..."}
              onSend={handleSend} 
              attachButton={false}
              disabled={!isStarted || isTyping || listening}
              value={transcript}
              onChange={(val) => { /* Required to make the input controlled */ }}
            />
          </ChatContainer>
        </MainContainer>
        <div className="mic-container">
          <button className={`mic-button ${listening ? 'listening' : ''}`} onClick={handleVoiceButtonClick} disabled={!isStarted || isTyping}>
            {listening ? "Stop" : "Or Click Here and Talk to Me"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;