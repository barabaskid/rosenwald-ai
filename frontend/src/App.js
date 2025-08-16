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
  
  // A ref to prevent the auto-send effect from firing on the initial empty transcript
  const hasTranscriptStarted = useRef(false);

  // This effect detects when the user stops talking and sends the message
  useEffect(() => {
    if (transcript) {
      hasTranscriptStarted.current = true; // Mark that we've received speech
    }
    
    // If listening has stopped AND there's a transcript to send
    if (!listening && hasTranscriptStarted.current && transcript.trim() !== "") {
      handleSend(transcript); // Automatically send the final transcript
      hasTranscriptStarted.current = false; // Reset for the next turn
    }
  }, [listening, transcript]);


  const welcomeMessage = {
    message: "Heya! My name's Arby, and I'm from Okahumpka, Florida where I go to a Rosenwald School. It's 1955, so my life is probably plenty different than yours. I hear you wanna know about my life. Well, ask me anything, friend!",
    sender: "Arby",
    direction: "incoming",
    audioUrl: "/audio/welcome.mp3"
  };

  const handleStart = () => {
    setIsStarted(true);
    setMessages([welcomeMessage]);
    const audio = new Audio(welcomeMessage.audioUrl);
    audio.play().catch(err => console.error("Audio playback failed:", err));
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
      const response = await fetch('http://localhost:3001/chat', {
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
        const audio = new Audio(`http://localhost:3001${data.audioUrl}`);
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
          <button className={`mic-button ${listening ? 'listening' : ''}`} onClick={handleVoiceButtonClick}>
            {listening ? "Stop" : "Or Click Here and Talk to Me"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;