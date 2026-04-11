"use client";
import React from "react";

interface DialGraphProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  percentages?: number[];
  colors?: string[];
}

export default function DialGraph({ 
  value, 
  maxValue = 100, 
  size = 120, 
  strokeWidth = 8,
  className = "",
  percentages = [],
  colors = []
}: DialGraphProps) {
  const radius = (size - strokeWidth) / 2;
  
  const getStrokeDashoffset = (percentage: number, currentCircumference: number) => {
    return currentCircumference - (percentage / 100) * currentCircumference;
  };

  // If no percentages provided, create a single circle based on value
  const displayPercentages = percentages.length > 0 ? percentages : [Math.min((value / maxValue) * 100, 100)];
  const displayColors = colors.length > 0 ? colors : ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

  // Calculate average percentage (product of all percentages)
  const averagePercentage = displayPercentages.length > 0 
    ? displayPercentages.reduce((a, b) => a * b, 0.01) 
    : Math.min((value / maxValue) * 100, 100);

  return (
    <div className={`relative ${className}`}>
      <svg
        width={size}
        height={size}
        className="overflow-visible"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Background circle */}
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeLinecap="round"
        />
        
        {/* Progress circles */}
        {displayPercentages.map((percentage, index) => {
          const currentRadius = radius - index * (strokeWidth + 5);
          const currentCircumference = 2 * Math.PI * currentRadius;

          if (percentage === 0) {
            return null;
          }

          return (
            <circle
              key={index}
              stroke={displayColors[index % displayColors.length]}
              fill="transparent"
              strokeWidth={strokeWidth}
              r={currentRadius}
              cx={size / 2}
              cy={size / 2}
              strokeDasharray={currentCircumference}
              strokeDashoffset={getStrokeDashoffset(percentage, currentCircumference)}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-all duration-1000 ease-out"
            />
          );
        })}
        
        {/* Value text */}
        <text
          x="50%" 
          y="50%" 
          dominantBaseline="middle" 
          textAnchor="middle" 
          fontSize="24" 
          fill="currentColor"
          className="text-gray-800 dark:text-white font-bold"
        >
          {Math.round(averagePercentage)}
        </text>
      </svg>
    </div>
  );
}
