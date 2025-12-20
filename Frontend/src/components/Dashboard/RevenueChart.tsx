import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';

interface ChartData {
  name: string;
  revenue: number;
  transactions: number;
}

type TimeRange = 'week' | 'month' | 'year';

const RevenueChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [loading, setLoading] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const formatTooltip = (value: number, name: string) => {
    if (name === 'revenue') {
      return [formatCurrency(value), 'Revenue'];
    }
    return [value, 'Transactions'];
  };

  const getDaysFromRange = (range: TimeRange): number => {
    switch (range) {
      case 'week':
        return 7;
      case 'month':
        return 30;
      case 'year':
        return 365;
      default:
        return 7;
    }
  };

  const fetchRevenueData = async (range: TimeRange) => {
    try {
      setLoading(true);
      const days = getDaysFromRange(range);
      console.log(`[Revenue Chart] Fetching data for range: ${range}, days: ${days}`);
      
      const response = await fetch(`/api/dashboard/revenue-chart?days=${days}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Revenue Chart] Data received:', data);
        console.log('[Revenue Chart] Data length:', data?.length);
        
        if (data && data.length > 0) {
          console.log('[Revenue Chart] Sample data point:', data[0]);
        }
        
        setChartData(data || []);
      } else {
        console.error('[Revenue Chart] Failed to fetch:', response.status, response.statusText);
        setChartData([]);
      }
    } catch (error) {
      console.error('[Revenue Chart] Error:', error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData(timeRange);
  }, [timeRange]);

  const handleRangeChange = (range: TimeRange) => {
    setTimeRange(range);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Revenue Overview</h3>
          <p className="text-xs text-gray-500 mt-0.5">Daily revenue and transaction trends</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => handleRangeChange('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeRange === 'week'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => handleRangeChange('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeRange === 'month'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => handleRangeChange('year')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeRange === 'year'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Year
            </button>
          </div>
        </div>
      </div>
      
      <div className="h-80 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        {!loading && chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-600 font-medium">No revenue data available</p>
              <p className="text-xs text-gray-500 mt-1">Transaction data will appear here once available</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                stroke="#6b7280"
                fontSize={11}
                tickMargin={8}
              />
              <YAxis 
                stroke="#6b7280"
                fontSize={11}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `₱${(value / 1000).toFixed(0)}k`;
                  }
                  return `₱${value}`;
                }}
              />
              <Tooltip 
                formatter={formatTooltip}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  fontSize: '12px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
