import express, { Request, Response } from "express";
import * as admin from "firebase-admin";
import ytdl, { videoInfo } from "ytdl-core";

admin.initializeApp();

const app = express();

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
    const audioFilePath = `hackathon_videos_from_download_api/${baseFileName}_A.mp3`;
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
      .then(() => {
        res.json({
          videoURI: gsVideoURI,
          audioURI: gsAudioURI,
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

export default app;
