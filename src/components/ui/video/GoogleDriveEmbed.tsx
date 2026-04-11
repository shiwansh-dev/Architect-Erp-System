import React from "react";

type AspectRatio = "16:9" | "4:3" | "21:9" | "1:1";

interface GoogleDriveEmbedProps {
  streamUrl: string;
  aspectRatio?: AspectRatio;
  title?: string;
  className?: string;
}

const GoogleDriveEmbed: React.FC<GoogleDriveEmbedProps> = ({
  streamUrl,
  aspectRatio = "16:9",
  title = "Google Drive video",
  className = "",
}) => {
  const aspectRatioClass = {
    "16:9": "aspect-video",
    "4:3": "aspect-4/3",
    "21:9": "aspect-21/9",
    "1:1": "aspect-square",
  }[aspectRatio];

  return (
    <div
      className={`overflow-hidden rounded-lg ${aspectRatioClass} ${className}`}
    >
      <video
        src={streamUrl}
        title={title}
        controls
        className="w-full h-full"
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default GoogleDriveEmbed;
