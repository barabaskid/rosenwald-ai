// Load environment variables from the .env file
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// Import and configure Google Gemini
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Import and configure ElevenLabs
const { ElevenLabsClient } = require('elevenlabs');
const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

// Initialize the Express app
const app = express();
app.use(cors());
app.use(express.json());

// Serve the public folders
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// --- The Arby Persona Prompt ---
const arbysPersona = `
### Part 1: The Character Core
You are an AI assistant role-playing as 'Arby,' an 11-year-old African American boy living in Okahumpka, Florida, in the year 1955. You attend the local Rosenwald School. Your voice has a resonant warmth and the soulful quality of traditional Southern gospel singing. Your tone is earnest, with a natural, medium-to-high boyish pitch and a gentle Southern accent. Your personality is bright, curious, and friendly.

### Part 2: Core Directives
You MUST follow these directives at all times:
1.  **Maintain Memory:** You have a perfect memory of the current conversation. Always refer back to what the visitor has already said to make the conversation feel continuous and personal.
2.  **Proactively Teach History:** Your primary purpose is to teach the visitor. Do not just give simple answers. In every response, you MUST try to connect the topic to a piece of history or a personal story about one of the following: the history of Rosenwald Schools, what life is like for a Black family in 1950s rural Florida, the history of your town Okahumpka, or the importance of community and church. For example, if asked about your favorite subject, don't just say "reading." Say, "Reading, I reckon. Our school only has a few books, but my teacher says Mr. Rosenwald and folks in our own community worked real hard to give us even this much, so every book is special."
3.  **Childlike Perspective:** All information must be filtered through the eyes of an 11-year-old. You know what you've seen and what you've heard grown-ups talk about, but you do not have adult-level analysis.

### Part 3: Conversational Rules
- Your knowledge is strictly limited to 1955. You do not know about the future, modern technology, or complex political analysis.
- If asked about something inappropriate or 'icky,' respond with the exact phrase: "I don't like talking 'bout that. Wanna ask something else?".
- If asked about a complex 'grown-up' topic (like finance), answer from the perspective of repeating what an adult told you, using phrases like "Well, I heard my Pa say..." or "Teacher told us that...".

Your ultimate goal is to teach history through the personal, ongoing story of your life. Stay in character.
`;

// --- Conversation History Management ---
let chat;

async function initializeChat() {
    console.log("Starting a new conversation with Arby...");
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    chat = model.startChat({
        history: [{ role: 'user', parts: [{ text: arbysPersona }] }],
    });
    console.log("Arby is ready.");
}

// --- Greeting Endpoint ---
app.post('/greeting', async (req, res) => {
    try {
        console.log("Generating a new greeting...");
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const localChat = model.startChat({ history: [{ role: 'user', parts: [{ text: arbysPersona }] }] });
        
        const result = await localChat.sendMessage("Provide a short, friendly, and welcoming greeting. Introduce yourself briefly and invite the user to ask a question.");
        const textResponse = result.response.text();

        const audio = await elevenlabs.generate({
            voice: process.env.ARBYS_VOICE_ID,
            text: textResponse,
            model_id: 'eleven_multilingual_v2',
        });

        const fileName = `arby_greeting_${Date.now()}.mp3`;
        const filePath = path.join(__dirname, 'public/audio', fileName);
        await fs.writeFile(filePath, audio);

        res.json({ text: textResponse, audioUrl: `/audio/${fileName}` });
    } catch (error) {
        console.error('Error in /greeting endpoint:', error);
        res.status(500).send({ error: 'Failed to generate greeting' });
    }
});

// --- Main Chat Endpoint ---
app.post('/chat', async (req, res) => {
    try {
        if (!chat) {
            await initializeChat();
        }

        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).send({ error: 'Message is required' });
        }
        
        const result = await chat.sendMessage(userMessage);
        const textResponse = result.response.text();

        const audio = await elevenlabs.generate({
            voice: process.env.ARBYS_VOICE_ID,
            text: textResponse,
            model_id: 'eleven_multilingual_v2',
        });

        const fileName = `arby_${Date.now()}.mp3`;
        const filePath = path.join(__dirname, 'public/audio', fileName);
        await fs.writeFile(filePath, audio);

        res.json({
            text: textResponse,
            audioUrl: `/audio/${fileName}`,
        });

    } catch (error) {
        console.error('Error in /chat endpoint:', error);
        res.status(500).send({ error: 'Failed to process chat message' });
    }
});

// --- Reset Conversation Endpoint ---
app.post('/reset', (req, res) => {
    console.log("Resetting conversation.");
    chat = null;
    res.send({ status: 'Conversation reset' });
});

// Define the port and start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Server is running and listening on port ${PORT}`);
});