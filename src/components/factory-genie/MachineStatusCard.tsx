"use client";
import React from "react";
import DialGraph from "./DialGraph";
import ProgressBar from "./ProgressBar";

interface MachineStatusCardProps {
  channelName: string;
  morningData: {
    run_time: number;
    working_time: number;
    value_sum: number;
    average: number;
    shift_time: string;
    average_threshold: number;
    setting_time: number;
  };
  nightData: {
    run_time: number;
    working_time: number;
    value_sum: number;
    average: number;
    shift_time: string;
    average_threshold: number;
    setting_time: number;
  };
  isActive?: boolean;
  cardColor?: "green" | "pink";
  selectedShift?: "all" | "morning" | "evening";
}

export default function MachineStatusCard({
  channelName,
  morningData,
  nightData,
  isActive = true,
  cardColor = "green",
  selectedShift = "morning"
}: MachineStatusCardProps) {
  // Select data based on shift
  const currentData = selectedShift === "evening" ? nightData : morningData;
  const shiftName = selectedShift === "evening" ? "Evening Shift" : "Morning Shift";
  
  // Calculate metrics
  const shiftDuration = currentData.working_time; // in minutes
  const runTimeMinutes = currentData.run_time;
  const runTimeHours = Math.floor(runTimeMinutes / 60);
  const runTimeMins = runTimeMinutes % 60;
  const runTimeFormatted = `${runTimeHours.toString().padStart(2, '0')}:${runTimeMins.toString().padStart(2, '0')}`;
  
  const runTimePercentage = (runTimeMinutes / shiftDuration) * 100;
  const runTimeEfficiency = (currentData.average / currentData.average_threshold) * 100;
  const overallEfficiency = (currentData.value_sum / (currentData.average_threshold * runTimeMinutes)) * 100;

  const cardBgColor = cardColor === "green" 
    ? "bg-green-50 dark:bg-green-900/20" 
    : "bg-pink-50 dark:bg-pink-900/20";

  return (
    <div className={`rounded-lg p-6 shadow-lg border ${cardBgColor} border-gray-200 dark:border-gray-700`}>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
          {channelName}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {shiftName}
        </p>
      </div>

      {/* Dial Graph */}
      <div className="flex justify-center mb-6">
        <DialGraph 
          value={currentData.average} 
          maxValue={currentData.average_threshold * 2}
          size={140}
          strokeWidth={8}
          percentages={[
            Math.min((currentData.average / currentData.average_threshold) * 100, 100),
            Math.min((runTimeEfficiency / 100) * 100, 100),
            Math.min((overallEfficiency / 100) * 100, 100)
          ]}
          colors={["#3b82f6", "#10b981", "#f59e0b"]}
        />
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <ProgressBar
          percentages={[
            Math.min((currentData.average / currentData.average_threshold) * 100, 100),
            Math.min((runTimeEfficiency / 100) * 100, 100),
            Math.min((overallEfficiency / 100) * 100, 100)
          ]}
          colors={["#3b82f6", "#10b981", "#f59e0b"]}
          labels={["Avg", "Run", "Overall"]}
        />
      </div>

      {/* Metrics */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Shift Duration:</span>
          <span className="font-medium text-gray-800 dark:text-white">
            {currentData.shift_time}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Run Time:</span>
          <span className="font-medium text-gray-800 dark:text-white">
            {runTimeFormatted} ({runTimePercentage.toFixed(2)}%)
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Run Time Efficiency:</span>
          <span className="font-medium text-gray-800 dark:text-white">
            {runTimeEfficiency.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Overall Efficiency:</span>
          <span className="font-medium text-gray-800 dark:text-white">
            {overallEfficiency.toFixed(2)}%
          </span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
          <span className="text-gray-600 dark:text-gray-400">Current Status:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            isActive 
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" 
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
          }`}>
            {isActive ? "ON" : "OFF"}
          </span>
        </div>
      </div>
    </div>
  );
}
