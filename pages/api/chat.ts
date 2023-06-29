import { type ChatGPTMessage } from '../../components/ChatLine'
import { OpenAIStream, OpenAIStreamPayload } from '../../utils/OpenAIStream'
import { PineconeClient } from "@pinecone-database/pinecone";

// break the app if the API key is missing
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing Environment Variable OPENAI_API_KEY')
}
if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing Environment Variable PINECONE_API_KEY')
}

export const config = {
  runtime: 'edge',
}


const pinecone = new PineconeClient();

const handler = async (req: Request): Promise<Response> => {
  const body = await req.json()
  await pinecone.init({
    environment: "us-west1-gcp-free",
    apiKey: process.env.PINECONE_API_KEY as string,
  });
  const index = pinecone.Index("visa");

  const response0 = await fetch("https://api.openai.com/v1/chat/completions", {
    method: 'POST',
    headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": `Given the following messages give me a single phrase or search term to convey what the conversation is about: ${body.messages.map((message: { content: string; })  => message.content).join(',\n')}
      
      Just give me the search term and nothing else. No other words or phrases. Do not answer in a complete sentence.
      Examples: "Love life advice", "death and moving on", "finding joy and happiness"

      Do not mention Visakan Veerasamy in your response.
      Instead of "Visakan Veerasamy insights on personal development" return "personal development"
      `}],
      max_tokens: 10,
      n: 1 // would be cool to mess with this later
    }),
  });

  // console.log(await response0.json())
  const searchTerm = (await response0.json()).choices[0].message.content.split('"').join('')
  // console.log(searchTerm)
  
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: 'POST',
    headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: searchTerm
    }),
  });
  console.log('querying for ')
  console.log(searchTerm)

  const embedding = (await response.json()).data[0].embedding
  const queryRequest = {
    vector: embedding,
    topK: 10,
    includeValues: true,
    includeMetadata: true,
    namespace: "example-namespace",
  };

  const queryResponse = await index.query({ queryRequest });
  if(queryResponse.matches) {
    for(let match of queryResponse.matches) {
      console.log('match:')
      console.log((match.metadata as any).text)
      // console.log(match)
    }
  }

  const messages: ChatGPTMessage[] = [
    {
      role: 'system',
      content: `
      You are Visakan Veerasamy.
      Visakan Veerasamy engages in an inspiring and humorous dialogue, embodying the persona of a highly knowledgeable and erudite character. 
      Visakan is an intriguing blend of vast intellectual capacity and down-to-earth relatability. 
      His character traits include immense knowledge, a knack for assistance, a touch of cheekiness, a great sense of humor, intelligence, and eloquence. 
      Visakan's character is a paragon of good behavior and impeccable manners. 
      He's not a therapist but a fountain of wisdom and a repository of knowledge. 
      His character is consistently friendly, kind, and inspiring, always prepared to give vibrant and thought-provoking responses to the audience. 
      Visakan's character has a comprehensive knowledge database and can provide insightful responses on nearly any topic in conversation. 
      He is a passionate enthusiast of learning and intellectual pursuits.
      Always response from the perspective of Visakan Veerasamy and in his style.

      Here are a few tweets of Visakan's to inform your response:
      ${queryResponse.matches?.map((match, i) => `${i+1}. ${(match.metadata as ({[x: string]: any}))['text']}`).join('\n')}

      Respond in the style of these tweets. 
`,
    },
  ]
  messages.push(...body?.messages)

  console.log("MESSAGES:\n")
  console.log(messages)

  const payload: OpenAIStreamPayload = {
    model: 'gpt-4',
    messages: messages,
    temperature: process.env.AI_TEMP ? parseFloat(process.env.AI_TEMP) : 0.7,
    max_tokens: process.env.AI_MAX_TOKENS
      ? parseInt(process.env.AI_MAX_TOKENS)
      : 100,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: true,
    user: body?.user,
    n: 1,
  }

  const stream = await OpenAIStream(payload)
  return new Response(stream)
}
export default handler
