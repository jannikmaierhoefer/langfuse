import "dd-trace/init";
import "./instrumentation"; // this is required to make instrumentation work
import express from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import * as middlewares from "./middlewares";
import api from "./api";
import MessageResponse from "./interfaces/MessageResponse";

require("dotenv").config();

import logger from "./logger";

import { evalJobCreator, evalJobExecutor } from "./queues/evalQueue";
import { batchExportJobExecutor } from "./queues/batchExportQueue";
import { repeatQueueExecutor } from "./queues/repeatQueue";
import helmet from "helmet";
import opentelemetry, { Span } from "@opentelemetry/api";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.get<{}, MessageResponse>("/", (req, res) => {
  const tracer = opentelemetry.trace.getTracer(
    "instrumentation-scope-name",
    "instrumentation-scope-version"
  );
  return tracer.startActiveSpan("rollTheDice", (span: Span) => {
    console.log("Rolling the dice");

    res.json({
      message: "Langfuse Worker API 🚀",
    });
    span.end();
  });
});

app.use("/api", api);

// The error handler must be before any other error middleware and after all controllers
app.use(Sentry.expressErrorHandler());

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

logger.info("Eval Job Creator started", evalJobCreator?.isRunning());
logger.info("Eval Job Executor started", evalJobExecutor?.isRunning());
logger.info(
  "Batch Export Job Executor started",
  batchExportJobExecutor?.isRunning()
);
logger.info("Repeat Queue Executor started", repeatQueueExecutor?.isRunning());

evalJobCreator?.on("failed", (job, err) => {
  logger.error(err, `Eval Job with id ${job?.id} failed with error ${err}`);
});

evalJobExecutor?.on("failed", (job, err) => {
  logger.error(
    err,
    `Eval execution Job with id ${job?.id} failed with error ${err}`
  );
});

batchExportJobExecutor?.on("failed", (job, err) => {
  logger.error(
    err,
    `Batch Export Job with id ${job?.id} failed with error ${err}`
  );
});

repeatQueueExecutor?.on("failed", (job, err) => {
  logger.error(
    err,
    `Repeat Queue Job with id ${job?.id} failed with error ${err}`
  );
});

export default app;
