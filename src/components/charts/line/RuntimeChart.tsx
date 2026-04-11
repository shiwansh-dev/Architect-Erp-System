"use client";
import React from "react";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

// Dynamically import the ReactApexChart component
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface ProcessedRow {
  date: string;
  channel: string;
  channelName: string;
  shift: 'morning' | 'night';
  runTime: number;
  workingTime: number;
  average: number;
  shiftTime: string;
  settingTime: number;
  runTimePercentage: number;
  runTimeEfficiency: number;
  oee: number;
}

interface ChartDataItem {
  date: string;
  totalRunTime: number;
  morningRunTime: number;
  nightRunTime: number;
  recordCount: number;
}

interface RuntimeChartProps {
  data: ProcessedRow[];
  filterLowValues?: boolean;
  selectedShifts?: string[];
  selectedMachines?: string[];
}

export default function RuntimeChart({ 
  data, 
  filterLowValues = false, 
  selectedShifts = ['morning', 'night'], 
  selectedMachines = [] 
}: RuntimeChartProps) {
  // Process data for the chart
  const processChartData = () => {
    // Apply the same filtering logic as the table
    let filteredData = data.filter(row => {
      const shiftMatch = selectedShifts.includes(row.shift);
      const machineMatch = selectedMachines.includes(row.channelName);
      return shiftMatch && machineMatch;
    });

    // Apply low values filter if enabled - treat morning and night shifts separately
    if (filterLowValues && filteredData.length > 0) {
      // Calculate thresholds separately for morning and night shifts
      const morningData = filteredData.filter(row => row.shift === 'morning');
      const nightData = filteredData.filter(row => row.shift === 'night');
      
      let morningThreshold = 0;
      let nightThreshold = 0;
      
      if (morningData.length > 0) {
        const morningAverage = morningData.reduce((sum, row) => sum + row.runTimePercentage, 0) / morningData.length;
        morningThreshold = morningAverage * 0.1; // 10% of morning average
      }
      
      if (nightData.length > 0) {
        const nightAverage = nightData.reduce((sum, row) => sum + row.runTimePercentage, 0) / nightData.length;
        nightThreshold = nightAverage * 0.1; // 10% of night average
      }
      
      // Filter each shift separately using its own threshold
      filteredData = filteredData.filter(row => {
        if (row.shift === 'morning') {
          return morningThreshold === 0 || row.runTimePercentage >= morningThreshold;
        } else {
          return nightThreshold === 0 || row.runTimePercentage >= nightThreshold;
        }
      });
    }

    // First, identify dates that should be completely excluded
    // A date should be excluded only if ALL shifts for that date were filtered out
    const excludedDates = new Set<string>();
    
    if (filterLowValues) {
      // Get all original data for the selected shifts and machines
      const originalData = data.filter(row => {
        const shiftMatch = selectedShifts.includes(row.shift);
        const machineMatch = selectedMachines.includes(row.channelName);
        return shiftMatch && machineMatch;
      });
      
      // Calculate thresholds for original data
      const morningData = originalData.filter(row => row.shift === 'morning');
      const nightData = originalData.filter(row => row.shift === 'night');
      
      let morningThreshold = 0;
      let nightThreshold = 0;
      
      if (morningData.length > 0) {
        const morningAverage = morningData.reduce((sum, row) => sum + row.runTimePercentage, 0) / morningData.length;
        morningThreshold = morningAverage * 0.1;
      }
      
      if (nightData.length > 0) {
        const nightAverage = nightData.reduce((sum, row) => sum + row.runTimePercentage, 0) / nightData.length;
        nightThreshold = nightAverage * 0.1;
      }
      
      // Group data by date to check which dates have all shifts filtered out
      const dateShiftData = originalData.reduce((acc, row) => {
        const date = row.date;
        if (!acc[date]) {
          acc[date] = { morning: null, night: null };
        }
        acc[date][row.shift] = row;
        return acc;
      }, {} as Record<string, { morning: ProcessedRow | null, night: ProcessedRow | null }>);
      
      // Check each date to see if ALL shifts for that date were filtered out
      Object.entries(dateShiftData).forEach(([date, shifts]) => {
        let allShiftsFiltered = true;
        
        // Check if morning shift exists and was filtered out
        if (shifts.morning && selectedShifts.includes('morning')) {
          const morningFiltered = morningThreshold > 0 && shifts.morning.runTimePercentage < morningThreshold;
          if (!morningFiltered) {
            allShiftsFiltered = false; // Morning shift passed the filter
          }
        }
        
        // Check if night shift exists and was filtered out
        if (shifts.night && selectedShifts.includes('night')) {
          const nightFiltered = nightThreshold > 0 && shifts.night.runTimePercentage < nightThreshold;
          if (!nightFiltered) {
            allShiftsFiltered = false; // Night shift passed the filter
          }
        }
        
        // Only exclude the date if ALL shifts for that date were filtered out
        if (allShiftsFiltered) {
          excludedDates.add(date);
        }
      });
    }

    // Group data by date and calculate total runtime per date
    const dateGroups = filteredData.reduce((acc, row) => {
      const date = row.date;
      
      // Skip dates that should be excluded
      if (excludedDates.has(date)) {
        return acc;
      }
      
      if (!acc[date]) {
        acc[date] = {
          date: date,
          totalRunTime: 0,
          morningRunTime: 0,
          nightRunTime: 0,
          recordCount: 0
        };
      }
      acc[date].totalRunTime += row.runTime;
      acc[date].recordCount += 1;
      
      if (row.shift === 'morning') {
        acc[date].morningRunTime += row.runTime;
      } else {
        acc[date].nightRunTime += row.runTime;
      }
      
      return acc;
    }, {} as Record<string, ChartDataItem>);

    // Convert to arrays and sort by date
    const chartData = Object.values(dateGroups).sort((a, b) => {
      const dateA = new Date(convertDateToISO(a.date));
      const dateB = new Date(convertDateToISO(b.date));
      return dateA.getTime() - dateB.getTime();
    });

    return chartData;
  };

  // Calculate trend line data using linear regression
  const calculateTrendLine = (chartData: ChartDataItem[]) => {
    if (chartData.length < 2) return [];
    
    const n = chartData.length;
    const xValues = chartData.map((_, index) => index);
    const yValues = chartData.map(item => item.totalRunTime);
    
    // Calculate slope and intercept using linear regression
    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Generate trend line points
    return xValues.map(x => slope * x + intercept);
  };

  // Utility function to convert YY/MM/DD to ISO format
  const convertDateToISO = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('/');
    const fullYear = `20${year}`;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // Format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('/');
    return `${day}/${month}/${year}`;
  };

  const chartData = processChartData();
  const trendLineData = calculateTrendLine(chartData);

  const options: ApexOptions = {
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    colors: (() => {
      const colors = ["#465FFF"]; // Blue for total runtime
      
      if (selectedShifts.includes('morning')) {
        colors.push("#9CB9FF"); // Light blue for morning
      }
      
      if (selectedShifts.includes('night')) {
        colors.push("#FF6B6B"); // Red for night
      }
      
      colors.push("#10B981"); // Green for trend line
      
      return colors;
    })(),
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 350,
      type: "line",
      toolbar: {
        show: true,
      },
      animations: {
        enabled: true,
        speed: 800,
      },
    },
    stroke: {
      curve: "smooth",
      width: (() => {
        const widths = [3]; // Thick line for total runtime
        
        if (selectedShifts.includes('morning')) {
          widths.push(2); // Medium line for morning
        }
        
        if (selectedShifts.includes('night')) {
          widths.push(2); // Medium line for night
        }
        
        widths.push(2); // Medium line for trend
        
        return widths;
      })(),
      lineCap: "round",
    },
    fill: {
      type: "solid",
      opacity: 0.1,
    },
    markers: {
      size: 4,
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 8,
      },
      fillOpacity: 1,
    },
    grid: {
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      x: {
        format: "dd MMM yyyy",
      },
      y: {
        formatter: (val: number) => `${formatMinutesToHHMM(val)}`,
      },
    },
    xaxis: {
      type: "category",
      categories: chartData.map(item => formatDateForDisplay(item.date)),
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#6B7280"],
        },
        rotate: -45,
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#6B7280"],
        },
        formatter: (val: number) => formatMinutesToHHMM(val),
      },
      title: {
        text: "Runtime (Hours:Minutes)",
        style: {
          fontSize: "14px",
          color: "#6B7280",
        },
      },
    },
  };

  const formatMinutesToHHMM = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Build series array based on selected shifts
  const series = [];
  
  // Always show total runtime
  series.push({
      name: "Total Runtime",
      data: chartData.map(item => item.totalRunTime || 0),
  });
  
  // Show morning shift only if it's selected
  if (selectedShifts.includes('morning')) {
    series.push({
      name: "Morning Shift",
      data: chartData.map(item => item.morningRunTime || 0),
    });
  }
  
  // Show night shift only if it's selected
  if (selectedShifts.includes('night')) {
    series.push({
      name: "Night Shift",
      data: chartData.map(item => item.nightRunTime || 0),
    });
  }
  
  // Always show trend line
  series.push({
    name: "Trend Line",
    data: trendLineData,
    type: "line",
  });

  if (chartData.length === 0) {
    return (
      <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
          Runtime vs Date Chart
        </h3>
        <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-400">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
      <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
        Runtime vs Date Chart
      </h3>
      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div id="runtimeChart" className="min-w-[800px]">
          <ReactApexChart
            options={options}
            series={series}
            type="line"
            height={350}
            width="100%"
          />
        </div>
      </div>
    </div>
  );
}
