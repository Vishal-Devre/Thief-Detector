"use client";
import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import { load as cocoSSDLoad } from "@tensorflow-models/coco-ssd";
import { throttle } from "lodash";

const ObjectDetection = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [fps, setFps] = useState(0);
  const [personDetected, setPersonDetected] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const audioRef = useRef(null);
  const personDetectionTimeRef = useRef(0);

  // Throttled function to play audio (only once every 10 seconds)
  const playDetectionAudio = throttle(
    () => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((error) => {
          console.log("Audio play failed:", error);
        }, 1000);
      }

      // Show notification
      setShowNotification(true);
      setTimeout(() => {
        setShowNotification(false);
      }, 2000);
    },
    10000,
    { trailing: false }
  ); // Only trigger once every 10 seconds

  const runCoco = async () => {
    setIsLoaded(true);
    // Load the model
    const net = await cocoSSDLoad();
    setIsLoaded(false);

    // Start detection loop with requestAnimationFrame for better performance
    const detectFrame = async (time) => {
      // Calculate FPS
      if (lastFrameTimeRef.current) {
        const delta = time - lastFrameTimeRef.current;
        setFps(Math.round(1000 / delta));
      }
      lastFrameTimeRef.current = time;

      if (webcamRef.current && webcamRef.current.video?.readyState === 4) {
        await runObjectDetection(net);
      }
      animationRef.current = requestAnimationFrame(detectFrame);
    };

    animationRef.current = requestAnimationFrame(detectFrame);
  };

  const runObjectDetection = async (net) => {
    if (
      webcamRef.current !== null &&
      webcamRef.current.video?.readyState === 4
    ) {
      // Get video properties
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Set video dimensions
      webcamRef.current.video.width = videoWidth;
      webcamRef.current.video.height = videoHeight;

      // Set canvas dimensions
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // Make detections
      const obj = await net.detect(video);

      // Check if person is detected
      const hasPerson = obj.some((detection) => detection.class === "person");

      if (hasPerson) {
        setPersonDetected(true);
        personDetectionTimeRef.current = Date.now();

        // Play audio alert (throttled to prevent spamming)
        playDetectionAudio();
      } else {
        // Reset person detection if no person is detected for more than 1 second
        if (Date.now() - personDetectionTimeRef.current > 1000) {
          setPersonDetected(false);
        }
      }

      // Draw detections
      const ctx = canvasRef.current.getContext("2d");
      drawRect(obj, ctx);

      // Update detected objects state
      setDetectedObjects(obj);
    }
  };

  const drawRect = (detections, ctx) => {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Fonts
    const font = "16px system-ui";
    ctx.font = font;
    ctx.textBaseline = "top";

    // Draw bounding boxes and labels
    detections.forEach((detection) => {
      const [x, y, width, height] = detection.bbox;
      const isPerson = detection.class === "person";

      // Draw the bounding box
      ctx.strokeStyle = isPerson ? "#FF0000" : "#00FFFF";
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);

      // Fill the color with transparency
      ctx.fillStyle = `rgba(255, 0, 0, ${isPerson ? 0.2 : 0})`;
      ctx.fillRect(x, y, width, height);

      // Draw the label background
      ctx.fillStyle = isPerson ? "#FF0000" : "#00FFFF";
      const text = `${detection.class} ${Math.round(detection.score * 100)}%`;
      const textWidth = ctx.measureText(text).width;
      const textHeight = parseInt(font, 10); // base 10
      ctx.fillRect(x, y, textWidth + 4, textHeight + 4);

      // Draw the text
      ctx.fillStyle = "#000000";
      ctx.fillText(text, x + 2, y + 2);
    });
  };

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio("/detection-alarm.mp3");

    runCoco();

    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full">
      {/* Notification Popup */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fadeInOut">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
            Person Detected!
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
              {isLoaded ? (
                <div className="h-96 flex flex-col items-center justify-center">
                  <div className="animate-pulse text-2xl">Loading Model...</div>
                  <div className="mt-4 h-2 w-64 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full animate-progress"></div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Webcam
                    ref={webcamRef}
                    className="w-full h-auto"
                    muted
                    audio={false}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{
                      facingMode: "environment",
                      width: { ideal: 1280 },
                      height: { ideal: 720 },
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full"
                  />
                  <div className="absolute top-4 right-4 bg-black bg-opacity-70 px-3 py-1 rounded-lg text-sm">
                    {fps} FPS
                  </div>

                  {/* Person Detection Indicator */}
                  {personDetected && (
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-lg text-sm flex items-center">
                      <svg
                        className="w-4 h-4 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        ></path>
                      </svg>
                      Person Detected
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-5 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-gray-700">
              Detection Results
            </h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {detectedObjects.length > 0 ? (
                detectedObjects.map((detection, index) => {
                  const isPerson = detection.class === "person";
                  return (
                    <div key={index} className="p-3 bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium capitalize">
                          {detection.class}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            isPerson ? "bg-red-600" : "bg-green-600"
                          }`}
                        >
                          {Math.round(detection.score * 100)}% confidence
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-300">
                        Bounding Box: [
                        {detection.bbox
                          .map((num) => Math.round(num))
                          .join(", ")}
                        ]
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No objects detected
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700">
              <h3 className="text-lg font-medium mb-3">Detection Stats</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold">
                    {detectedObjects.length}
                  </div>
                  <div className="text-xs text-gray-300">Objects Detected</div>
                </div>
                <div className="bg-gray-700 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold">{fps}</div>
                  <div className="text-xs text-gray-300">Frames Per Second</div>
                </div>
              </div>

              {/* Person Detection Status */}
              <div className="mt-4 bg-gray-700 p-3 rounded-lg text-center">
                <div className="text-lg font-bold flex items-center justify-center">
                  {personDetected ? (
                    <>
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                      Person Detected
                    </>
                  ) : (
                    "No Person Detected"
                  )}
                </div>
                <div className="text-xs text-gray-300 mt-1">Current Status</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          20% {
            opacity: 1;
            transform: translateY(0);
          }
          80% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
        .animate-fadeInOut {
          animation: fadeInOut 2s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <header className="pt-16 pb-12 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-green-400 to-teal-500 bg-clip-text text-transparent">
          AI-Powered Object Detection
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Real-time object recognition using TensorFlow.js and COCO-SSD model.
          See the world through AI eyes.
        </p>
      </header>

      <main className="container mx-auto px-4 pb-16">
        <ObjectDetection />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                ></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Real-Time Detection</h3>
            <p className="text-gray-400">
              Processes video feed in real-time with high accuracy and
              performance.
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">80+ Categories</h3>
            <p className="text-gray-400">
              Identifies objects across 80 different categories with confidence
              scores.
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                ></path>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Browser-Based</h3>
            <p className="text-gray-400">
              Runs entirely in your browser - no data sent to servers, ensuring
              privacy.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-gray-500 border-t border-gray-700">
        <p>
          © {new Date().getFullYear()} Object Detection App. Built with
          TensorFlow.js and Next.js by Vishal Devre.
        </p>
      </footer>
    </div>
  );
}
