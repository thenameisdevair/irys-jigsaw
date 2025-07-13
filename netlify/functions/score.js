// netlify/functions/score.js
import { Irys } from "@irys/sdk";
import dotenv from "dotenv";
dotenv.config();                             // allows local testing with a .env file

// --------------  Configure Irys client -------------- //
const irys = new Irys({
  network: "mainnet",
  token:   "matic",
  providerUrl: "https://polygon-rpc.com",
  key: process.env.IRYS_KEY.startsWith('{')
  ? JSON.parse(process.env.IRYS_KEY)   // JSON keyfile
  : process.env.IRYS_KEY               // raw 0x hex
 // <- environment variable
});

// --------------  Netlify handler -------------- //
export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { nickname, moves, time } = body;

    // basic validation
    if (!nickname || !moves || !time) {
      return { statusCode: 400, body: "Bad Request" };
    }

    // add tags so we can query later
    const tags = [
      { name: "app",     value: "irys-jigsaw" },
      { name: "nickname", value: nickname },
      { name: "moves",    value: String(moves) },
      { name: "time",     value: String(time) }
    ];

    // upload score JSON to Irys
    const txId = await irys.upload(JSON.stringify(body), { tags });

    return {
      statusCode: 200,
      body: JSON.stringify({ txId })
    };
  } catch (err) {
    console.error("Score upload failed:", err);
    return { statusCode: 500, body: "Upload failed" };
  }
}
