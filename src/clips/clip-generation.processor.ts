import { Injectable, Logger } from '@nestjs/common';
import { Clip } from './clip.entity';
import { calculateViralityScore } from './virality-score.util';
import { cutClip } from './ffmpeg.util';

export interface ClipGenerationJob {
  videoId: string;
  /** Absolute path to the source video file */
  inputPath: string;
  /** Absolute path for the output clip file */
  outputPath: string;
  /** Start time in seconds — float safe (e.g. 12.5) */
  startTime: number;
  /** End time in seconds — float safe (e.g. 45.7) */
  endTime: number;
  /** Total duration of the source video in seconds (used to clamp endTime) */
  videoDuration?: number;
  /** 0.0–1.0: where in the source video this clip starts */
  positionRatio: number;
  transcript?: string;
}

/**
 * Clip-generation processor.
 *
 * Currently runs synchronously as a plain NestJS provider.
 * When a queue is introduced, convert this to a BullMQ @Processor class
 * and decorate `process()` with @Process() — the scoring logic stays unchanged.
 */
@Injectable()
export class ClipGenerationProcessor {
  private readonly logger = new Logger(ClipGenerationProcessor.name);

  async process(job: ClipGenerationJob): Promise<Clip> {
    const durationSeconds = job.endTime - job.startTime;

    // Cut the video file — float startTime/endTime are handled safely inside cutClip
    await cutClip({
      inputPath: job.inputPath,
      outputPath: job.outputPath,
      startTime: job.startTime,
      endTime: job.endTime,
      videoDuration: job.videoDuration,
    });

    const viralityScore = calculateViralityScore({
      durationSeconds,
      positionRatio: job.positionRatio,
      transcript: job.transcript,
    });

    this.logger.log(
      `Clip scored — videoId=${job.videoId} ` +
        `duration=${durationSeconds}s ` +
        `position=${(job.positionRatio * 100).toFixed(0)}% ` +
        `viralityScore=${viralityScore}`,
    );

    return {
      id: `${job.videoId}-${job.startTime}-${job.endTime}`,
      videoId: job.videoId,
      startTime: job.startTime,
      endTime: job.endTime,
      positionRatio: job.positionRatio,
      transcript: job.transcript,
      viralityScore,
      createdAt: new Date(),
    };
  }
}
