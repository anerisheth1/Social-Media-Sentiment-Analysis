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
    const filePath = `hackathon_videos_from_download_api/${title}_${timestamp}.mp4`;
    const file = admin.storage().bucket().file(filePath);

    const writeStream = file.createWriteStream();

    ytdl(url).pipe(writeStream);

    writeStream.on("error", (error) => {
      throw new Error(`Error writing the video to Firebase Storage: ${error}`);
    });

    writeStream.on("finish", () => {
      res.send(
        `Video '${title}' has been downloaded and saved to Firebase Storage`
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while downloading the video");
  }
});

export default app;
