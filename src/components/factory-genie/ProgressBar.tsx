"use client";
import React from "react";

interface ProgressBarProps {
  percentages: number[];
  colors: string[];
  labels?: string[];
  className?: string;
}

export default function ProgressBar({ 
  percentages, 
  colors, 
  labels = [], 
  className = "" 
}: ProgressBarProps) {
  const totalPercentage = percentages.reduce((sum, p) => sum + p, 0);
  
  return (
    <div className={`progress-container ${className}`}>
      <div className="progress-bars h-12 mt-4 overflow-hidden bg-gray-200 dark:bg-gray-700 rounded-full">
        {percentages.map((percentage, index) => {
          const width = totalPercentage > 0 ? (percentage / totalPercentage) * 100 : 0;
          const label = labels[index] || `${Math.round(percentage)}%`;
          
          return (
            <div
              key={index}
              className="progress-bar flex items-center justify-center text-white font-bold relative"
              style={{
                width: `${width}%`,
                backgroundColor: colors[index % colors.length],
                borderRadius: index === 0 && percentages.length > 1 
                  ? '25px 0 0 25px' 
                  : index === percentages.length - 1 && percentages.length > 1
                  ? '0 25px 25px 0'
                  : '0'
              }}
            >
              <span className="progress-label text-xs">
                {percentage > 5 ? label : ''}
              </span>
              {index < percentages.length - 1 && (
                <div 
                  className="absolute right-0 w-0.5 h-full bg-white opacity-50"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
