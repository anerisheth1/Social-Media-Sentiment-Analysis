import * as functions from "firebase-functions";
import * as logger from "firebase-functions/logger";
import MainExecutor from "./MainExecutor";

const helloWorld = functions.https.onRequest((request, response) => {
  logger.info("Hello logs!", { structuredData: true });
  response.send("Hello from Firebase!");
});

const hackathon_app = functions.https.onRequest(MainExecutor);

export { helloWorld, hackathon_app };
