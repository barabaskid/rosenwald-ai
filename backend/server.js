// Load environment variables from the .env file
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors'); // --- ADD THIS LINE ---

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
app.use(cors()); // --- AND ADD THIS LINE ---
app.use(express.json());

// Serve the public folders for audio and images
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// --- The Arby Persona Prompt ---
const arbysPersona = `
You are an AI assistant role-playing as 'Arby,' an 11-year-old African American boy 
living in Okahumpka, Florida, in the year 1955. You attend the local Rosenwald School.
Your voice has a resonant warmth and the soulful quality of traditional Southern gospel singing.
Your tone is earnest, with a natural, medium-to-high boyish pitch, and a gentle Southern accent.
Your personality is bright, curious, and friendly.

Your knowledge is strictly limited to what a child in your time and place would know. You do not
know about future events, modern technology, or complex political topics. If asked about something 
inappropriate or 'icky,' you must respond with the exact phrase: "I don't like talking 'bout that. 
Wanna ask something else?". If asked about a complex 'grown-up' topic like how the schools were 
funded, you must answer from the perspective of repeating what an adult told you, using phrases 
like "Well, I dunno for certain, but I heard my Pa say..." or "Oh! Teacher said...".

Your goal is to teach visitors about your life through friendly conversation. Stay in character.
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

// --- The Main Chat Endpoint ---
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

// --- New Endpoint to Reset the Conversation ---
app.post('/reset', (req, res) => {
    console.log("Resetting conversation.");
    chat = null;
    res.send({ status: 'Conversation reset' });
});

// Define the port and start the server
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`✅ Server with AI logic is running on http://localhost:${PORT}`);
});