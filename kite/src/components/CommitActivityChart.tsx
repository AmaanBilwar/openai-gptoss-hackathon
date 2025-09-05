"use client"

import { useState, useCallback, useMemo } from "react"
import { TrendingUp, GitCommit, User, Calendar, Filter, BarChart3, RotateCcw, ZoomIn, ZoomOut, Move } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from "date-fns"
import type { DateRange } from "react-day-picker"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

// Mock data for demonstration - this will be replaced with real data from your backend
const generateMockData = () => {
  const data = []
  const today = new Date()
  
  // Generate 6 months of data
  for (let i = 180; i >= 0; i--) {
    const date = subDays(today, i)
    data.push({
      date: format(date, 'yyyy-MM-dd'),
      aiCommits: Math.floor(Math.random() * 30) + 5,
      manualCommits: Math.floor(Math.random() * 20) + 2,
    })
  }
  return data
}

const allData = generateMockData()

const chartConfig = {
  aiCommits: {
    label: "Kite AI Commits",
    color: "hsl(var(--chart-1))",
  },
  manualCommits: {
    label: "Manual Commits",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

type Timeframe = "7" | "30" | "90" | "180" | "365" | "all"
type FilterMode = "both" | "ai" | "manual"
type ViewMode = "absolute" | "percentage"

export function CommitActivityChart() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("7") // Default to 7 days
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined)
  const [filterMode, setFilterMode] = useState<FilterMode>("both")
  const [viewMode, setViewMode] = useState<ViewMode>("absolute")
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  
  // Zoom state (no panning)
  const [zoomState, setZoomState] = useState({
    xStart: 0,
    xEnd: 1,
    yMin: 0,
    yMax: 100,
    isZoomed: false
  })

  // Filter data based on selected timeframe
  const getFilteredData = () => {
    let filteredData = allData

    if (customDateRange?.from && customDateRange?.to) {
      filteredData = allData.filter(item => {
        const itemDate = new Date(item.date)
        return itemDate >= customDateRange.from! && itemDate <= customDateRange.to!
      })
    } else {
      const days = selectedTimeframe === "all" ? 365 : parseInt(selectedTimeframe)
      const cutoffDate = subDays(new Date(), days)
      filteredData = allData.filter(item => new Date(item.date) >= cutoffDate)
    }

    // Apply zoom range if set
    if (zoomState.isZoomed) {
      const startIndex = Math.floor(zoomState.xStart * filteredData.length)
      const endIndex = Math.floor(zoomState.xEnd * filteredData.length)
      filteredData = filteredData.slice(startIndex, endIndex + 1)
    }

    return filteredData
  }

  const filteredData = getFilteredData()

  // Transform data based on filter and view mode
  const chartData = filteredData.map(item => {
    let aiCommits = item.aiCommits
    let manualCommits = item.manualCommits

    // Apply filter mode
    if (filterMode === "ai") {
      manualCommits = 0
    } else if (filterMode === "manual") {
      aiCommits = 0
    }

    // Apply view mode
    if (viewMode === "percentage") {
      const total = aiCommits + manualCommits
      if (total > 0) {
        aiCommits = Math.round((aiCommits / total) * 100)
        manualCommits = Math.round((manualCommits / total) * 100)
      }
    }

    return {
      ...item,
      aiCommits,
      manualCommits,
    }
  })

  // Calculate totals for the footer
  const totalAiCommits = filteredData.reduce((sum, item) => sum + item.aiCommits, 0)
  const totalManualCommits = filteredData.reduce((sum, item) => sum + item.manualCommits, 0)
  const totalCommits = totalAiCommits + totalManualCommits
  const aiPercentage = totalCommits > 0 ? Math.round((totalAiCommits / totalCommits) * 100) : 0

  const handleTimeframeChange = (value: Timeframe) => {
    setSelectedTimeframe(value)
    setCustomDateRange(undefined) // Clear custom range when selecting predefined timeframe
  }

  const handleCustomDateSelect = (range: DateRange | undefined) => {
    setCustomDateRange(range)
    if (range?.from && range?.to) {
      setSelectedTimeframe("all") // Reset to "all" when using custom range
      setDatePickerOpen(false) // Close picker when range is selected
    }
  }

  const handleReset = () => {
    setSelectedTimeframe("7") // Reset to default 7 days
    setCustomDateRange(undefined)
    setZoomState({
      xStart: 0,
      xEnd: 1,
      yMin: 0,
      yMax: 100,
      isZoomed: false
    })
    setFilterMode("both")
    setViewMode("absolute")
  }

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomState(prev => {
      const center = (prev.xStart + prev.xEnd) / 2
      const range = prev.xEnd - prev.xStart
      const newRange = range * 0.7 // Zoom in by 30%
      const newStart = Math.max(0, center - newRange / 2)
      const newEnd = Math.min(1, center + newRange / 2)
      
      return {
        ...prev,
        xStart: newStart,
        xEnd: newEnd,
        isZoomed: true
      }
    })
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomState(prev => {
      const center = (prev.xStart + prev.xEnd) / 2
      const range = prev.xEnd - prev.xStart
      const newRange = Math.min(1, range * 1.3) // Zoom out by 30%
      const newStart = Math.max(0, center - newRange / 2)
      const newEnd = Math.min(1, center + newRange / 2)
      
      return {
        ...prev,
        xStart: newStart,
        xEnd: newEnd,
        isZoomed: newRange < 1
      }
    })
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoomState({
      xStart: 0,
      xEnd: 1,
      yMin: 0,
      yMax: 100,
      isZoomed: false
    })
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 1.1 : 0.9 // Zoom out or in
    
    setZoomState(prev => {
      const center = (prev.xStart + prev.xEnd) / 2
      const range = prev.xEnd - prev.xStart
      const newRange = Math.max(0.01, Math.min(1, range * delta))
      const newStart = Math.max(0, center - newRange / 2)
      const newEnd = Math.min(1, center + newRange / 2)
      
      return {
        ...prev,
        xStart: newStart,
        xEnd: newEnd,
        isZoomed: newRange < 1
      }
    })
  }, [])

  return (
    <Card
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle
              className="text-sm font-medium tracking-wider"
              style={{ color: "hsl(var(--card-foreground))" }}
            >
              COMMIT ACTIVITY
            </CardTitle>
            <CardDescription
              style={{ color: "hsl(var(--muted-foreground))" }}
              className="text-xs"
            >
              {customDateRange?.from && customDateRange?.to
                ? `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd, yyyy')}`
                : selectedTimeframe === "all"
                ? "All time"
                : `Last ${selectedTimeframe === "7" ? "7 days" : selectedTimeframe === "30" ? "30 days" : selectedTimeframe === "90" ? "3 months" : selectedTimeframe === "180" ? "6 months" : "1 year"}`
              } - {viewMode === "percentage" ? "Percentage view" : "Absolute numbers"}
            </CardDescription>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Timeframe Selector */}
            <Select value={selectedTimeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 3 Months</SelectItem>
                <SelectItem value="180">Last 6 Months</SelectItem>
                <SelectItem value="365">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Enhanced Custom Date Range Picker */}
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-3 text-xs"
                  style={{
                    backgroundColor: customDateRange?.from && customDateRange?.to 
                      ? "hsl(var(--primary))" 
                      : "hsl(var(--background))",
                    color: customDateRange?.from && customDateRange?.to 
                      ? "hsl(var(--primary-foreground))" 
                      : "hsl(var(--foreground))"
                  }}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {customDateRange?.from && customDateRange?.to 
                    ? `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd')}`
                    : "Custom Range"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 border-b">
                  <div className="text-sm font-medium mb-2">Select Date Range</div>
                  <div className="text-xs text-muted-foreground">
                    Click start date, then end date to select range
                  </div>
                </div>
                <CalendarComponent
                  initialFocus
                  mode="range"
                  defaultMonth={customDateRange?.from}
                  selected={customDateRange}
                  onSelect={handleCustomDateSelect}
                  numberOfMonths={2}
                  className="rounded-md border-0"
                  classNames={{
                    day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_range_start: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_range_end: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_outside: "text-muted-foreground opacity-50",
                    day_hidden: "invisible",
                  }}
                />
                <div className="p-3 border-t flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setCustomDateRange(undefined)
                      setDatePickerOpen(false)
                    }}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setDatePickerOpen(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Filter Toggle */}
            <Select value={filterMode} onValueChange={(value: FilterMode) => setFilterMode(value)}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="ai">AI Only</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setViewMode(viewMode === "absolute" ? "percentage" : "absolute")}
              title={`Switch to ${viewMode === "absolute" ? "percentage" : "absolute"} view`}
            >
              <BarChart3 className="h-3 w-3" />
            </Button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border rounded" style={{ borderColor: "hsl(var(--border))" }}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleZoomIn}
                title="Zoom In"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleZoomOut}
                title="Zoom Out"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleResetZoom}
                title="Reset Zoom"
                disabled={!zoomState.isZoomed}
              >
                <Move className="h-3 w-3" />
              </Button>
            </div>

            {/* Reset Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleReset}
              title="Reset to default (Last 7 days)"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div 
          className="relative"
          onWheel={handleWheel}
        >
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 8,
                right: 8,
                top: 8,
                bottom: 8,
              }}
            >
            <CartesianGrid 
              vertical={false} 
              stroke="hsl(var(--border))"
              strokeOpacity={0.3}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }}
              style={{
                fontSize: '12px',
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              style={{
                fontSize: '12px',
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
            <ChartTooltip 
              cursor={false} 
              content={<ChartTooltipContent />}
            />
            {filterMode !== "manual" && (
              <Line
                dataKey="aiCommits"
                type="monotone"
                stroke="var(--color-aiCommits)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--color-aiCommits)", strokeWidth: 2 }}
              />
            )}
            {filterMode !== "ai" && (
              <Line
                dataKey="manualCommits"
                type="monotone"
                stroke="var(--color-manualCommits)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--color-manualCommits)", strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ChartContainer>
        
        {/* Zoom Instructions */}
        <div className="px-4 py-2 border-t text-xs" style={{ 
          borderColor: "hsl(var(--border))",
          backgroundColor: "hsl(var(--muted) / 0.05)"
        }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "hsl(var(--muted-foreground))" }}>
              🖱️ Mouse wheel to zoom • Use zoom controls above
            </span>
            {zoomState.isZoomed && (
              <span style={{ color: "hsl(var(--primary))" }} className="font-medium">
                Zoomed: {Math.round((1 - (zoomState.xEnd - zoomState.xStart)) * 100)}% zoom level
              </span>
            )}
          </div>
        </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <div className="flex w-full items-start gap-4 text-sm">
          {filterMode !== "manual" && (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "hsl(var(--chart-1))" }}
              />
              <span
                style={{ color: "hsl(var(--muted-foreground))" }}
                className="text-xs"
              >
                <GitCommit className="w-3 h-3 inline mr-1" />
                AI Commits: {viewMode === "percentage" ? `${aiPercentage}%` : totalAiCommits}
              </span>
            </div>
          )}
          {filterMode !== "ai" && (
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: "hsl(var(--chart-2))" }}
              />
              <span
                style={{ color: "hsl(var(--muted-foreground))" }}
                className="text-xs"
              >
                <User className="w-3 h-3 inline mr-1" />
                Manual: {viewMode === "percentage" ? `${100 - aiPercentage}%` : totalManualCommits}
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">
            <TrendingUp className="h-3 w-3" style={{ color: "hsl(var(--chart-1))" }} />
            <span
              style={{ color: "hsl(var(--foreground))" }}
              className="text-xs font-medium"
            >
              {aiPercentage}% AI
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
