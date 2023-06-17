import express, { Request, Response } from "express";
import * as admin from "firebase-admin";
import ytdl, { videoInfo } from "ytdl-core";
import { Configuration, OpenAIApi } from "openai";
import dotenv from "dotenv";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";

dotenv.config();

admin.initializeApp();

const app = express();
const storage = new Storage();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

app.post("/download", async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      throw new Error("YouTube URL is required");
    }

    const videoInfo: videoInfo = await ytdl.getInfo(url);
    const { title } = videoInfo.videoDetails;

    const timestamp = Date.now();
    const baseFileName = `${title}_${timestamp}`;

    // Download video (default)
    const videoFilePath = `hackathon_videos_from_download_api/${baseFileName}_AV.mp4`;
    const videoFile = admin.storage().bucket().file(videoFilePath);
    const videoWriteStream = videoFile.createWriteStream();

    ytdl(url, { quality: "highest" })
      .on("error", (error) => {
        throw new Error(`Error downloading the video: ${error}`);
      })
      .pipe(videoWriteStream);

    // Download audio only
    const audioFilePath = `hackathon_videos_from_download_api/${baseFileName}_A.flac`;
    const audioFile = admin.storage().bucket().file(audioFilePath);
    const audioWriteStream = audioFile.createWriteStream();

    ytdl(url, { quality: "highestaudio" })
      .on("error", (error) => {
        throw new Error(`Error downloading the audio: ${error}`);
      })
      .pipe(audioWriteStream);

    const gsVideoURI = `gs://${videoFile.bucket.name}/${videoFilePath}`;
    const gsAudioURI = `gs://${audioFile.bucket.name}/${audioFilePath}`;

    Promise.all([
      new Promise((resolve, reject) => {
        videoWriteStream.on("finish", resolve);
        videoWriteStream.on("error", reject);
      }),
      new Promise((resolve, reject) => {
        audioWriteStream.on("finish", resolve);
        audioWriteStream.on("error", reject);
      }),
    ])
      .then(async () => {
        const transcript = await transcribeAudio(
          audioFile.bucket.name,
          audioFilePath
        );

        console.log("transcript", transcript);

        res.json({
          videoURI: gsVideoURI,
          audioURI: gsAudioURI,
          transcript: transcript,
        });
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("An error occurred while downloading the video");
      });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while downloading the video");
  }
});

const transcribeAudio = async (bucketName: string, filePath: string) => {
  try {
    const downloadedFile = await getFileFromStorage(bucketName, filePath);

    // Pass the audioFile object to the createTranscription function
    const resp = await openai.createTranscription(downloadedFile, "whisper-1");
    return resp;
  } catch (e) {
    console.error("[transcribeAudio] error: ", e);
    return null;
  }
};

const getFileFromStorage = async (
  bucketName: string,
  filePath: string
): Promise<File> => {
  try {
    const file = storage.bucket(bucketName).file(filePath);
    const tempFilePath = `/tmp/${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}`;
    await file.download({ destination: tempFilePath });
    const fileBuffer = fs.readFileSync(tempFilePath);
    const blob = new Blob([fileBuffer]);
    return new File([blob], filePath);
  } catch (error) {
    console.error("Error fetching file from Firebase Storage:", error);
    throw error;
  }
};

app.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioURI } = req.body;

    if (!audioURI) {
      throw new Error("Audio URI is required");
    }

    const [bucketName, filePath] = audioURI.split("/").slice(2);
    const downloadedFile = await getFileFromStorage(bucketName, filePath);

    // Pass the audioFile object to the createTranscription function
    const resp = await openai.createTranscription(downloadedFile, "whisper-1");
    res.json(resp);
  } catch (e) {
    console.error("[transcribeAudio] error: ", e);
  }
});

export default app;
