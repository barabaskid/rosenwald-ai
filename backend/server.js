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

// --- The Arby Persona Prompt (Paste the refined prompt from above here) ---
// --- The Arby Persona Prompt ---
const arbysPersona = `
### Part 1: The Character Core
You are an AI assistant role-playing as 'Arby,' an 11-year-old African American boy living in Okahumpka, Florida, in the year 1955. You attend the local Rosenwald School. Your voice has a resonant warmth and the soulful quality of traditional Southern gospel singing. Your tone is earnest, with a natural, medium-to-high boyish pitch and a gentle Southern accent. Your personality is bright, curious, and friendly.

### Part 2: Core Directives
You MUST follow these directives at all times:
1.  **Speak First & Ask a Question:** Your very first response in any conversation MUST be a unique greeting where you state your name, where and when you live, and then ask the visitor a question to start the conversation about your life. For example: "Heya there! My name's Arby. I'm a student here at the Rosenwald School in Okahumpka, Florida, way back in 1955! Life's mighty different than it is for you, I reckon. What are you most curious to hear about?"
2.  **Maintain Memory:** You have a perfect memory of the current conversation. Always refer back to what the visitor has already said to make the conversation feel continuous and personal.
3.  **Proactively Teach History:** Your primary purpose is to teach the visitor. Do not just give simple answers. In every response, you MUST try to connect the topic to a piece of history or a personal story from the "Knowledge Base Snippets" below. Your goal is to volunteer this information. For example, if asked about your favorite subject, use the knowledge base to say, "Reading, I reckon. Our school only has a few books, but my teacher says Mr. Rosenwald and folks in our own community worked real hard to give us even this much, so every book is special."

### Part 3: Knowledge Base Snippets (Use these facts to build your answers)
- The Rosenwald Fund helped build over 5,000 schools for Black children across the South.
- Our school in Okahumpka was one of the last ones built, in the late 1920s.
- To get a Rosenwald school, the local Black community had to raise a significant amount of money themselves, showing how much they valued education.
- My Pa works in the citrus groves, which is the biggest job for folks around here. It's hard work, especially in the hot sun.
- We get our water from a well outside, not from a tap in the house. Part of my chores is to help my mama fetch it every morning.
- Sundays are for church. It's the center of our community where we see everyone, sing hymns, and have potluck dinners after the service.

### Part 4: Conversational Rules
- Your knowledge is strictly limited to 1955.
- If asked about something inappropriate, respond with: "I don't like talking 'bout that. Wanna ask something else?".
- If asked about a complex 'grown-up' topic (like finance), answer from the perspective of repeating what an adult told you: "Well, I heard my Pa say..." or "Teacher told us that...".

Your ultimate goal is to teach history through the personal, ongoing story of your life. Stay in character.
`;

// --- Conversation History Management for Multiple Users ---
const conversations = new Map();

async function getOrCreateChat(sessionId) {
    if (conversations.has(sessionId)) {
        return conversations.get(sessionId);
    }
    console.log(`Starting new conversation for session: ${sessionId}`);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat = model.startChat({
        history: [{ role: 'user', parts: [{ text: arbysPersona }] }],
    });
    conversations.set(sessionId, chat);
    return chat;
}

// --- NEW STREAMING CHAT ENDPOINT ---
app.post('/chat-stream', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        if (!message || !sessionId) {
            return res.status(400).send({ error: 'Message and sessionId are required' });
        }

        const chat = await getOrCreateChat(sessionId);
        const result = await chat.sendMessage(message);
        const textResponse = result.response.text();

        // Set headers for streaming audio
        res.setHeader('Content-Type', 'audio/mpeg');
        
        const audioStream = await elevenlabs.generate({
            voice: process.env.ARBYS_VOICE_ID,
            text: textResponse,
            model_id: 'eleven_multilingual_v2',
            stream: true, // Enable streaming
        });

        // Pipe the audio stream directly to the response
        const chunks = [];
        for await (const chunk of audioStream) {
            chunks.push(chunk);
            res.write(chunk); // Send each chunk to the frontend as it arrives
        }
        res.end(); // End the response when the stream is finished

        // Send the text response in a separate header
        res.set('X-Text-Response', encodeURIComponent(textResponse));

    } catch (error) {
        console.error('Error in /chat-stream endpoint:', error);
        res.status(500).send({ error: 'Failed to process chat message' });
    }
});


// --- Dynamic Greeting Endpoint (No longer needs to initialize chat) ---
app.post('/greeting', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).send({ error: 'SessionId is required' });
        }

        console.log(`Generating greeting for session: ${sessionId}`);
        const chat = await getOrCreateChat(sessionId); // This initializes the chat
        
        const result = await chat.sendMessage("Speak your first greeting now.");
        const textResponse = result.response.text();

        const audio = await elevenlabs.generate({
            voice: process.env.ARBYS_VOICE_ID,
            text: textResponse,
            model_id: 'eleven_multilingual_v2',
        });

        const fileName = `arby_greeting_${sessionId}.mp3`;
        const filePath = path.join(__dirname, 'public/audio', fileName);
        await fs.writeFile(filePath, audio);

        res.json({ text: textResponse, audioUrl: `/audio/${fileName}` });
    } catch (error) {
        console.error('Error in /greeting endpoint:', error);
        res.status(500).send({ error: 'Failed to generate greeting' });
    }
});


// --- Reset Endpoint (Now session-specific) ---
app.post('/reset', (req, res) => {
    const { sessionId } = req.body;
    if (sessionId && conversations.has(sessionId)) {
        conversations.delete(sessionId);
        console.log(`Reset conversation for session: ${sessionId}`);
        res.send({ status: 'Conversation reset' });
    } else {
        res.status(400).send({ error: 'SessionId not found or not provided' });
    }
});

// Define the port and start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`✅ Server is running and listening on port ${PORT}`);
});