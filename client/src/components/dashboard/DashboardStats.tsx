import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessageSquare, Hash, TrendingUp, Trophy } from "lucide-react";

interface DashboardAnalytics {
  totalMessages: number;
  totalBoards: number;
  messagesThisWeek: number;
  mostActiveBoard: { name: string; count: number; type: 'private' | 'shared' } | null;
  messagesOverTime: { date: string; count: number }[];
  topBoards: { name: string; count: number; type: 'private' | 'shared' }[];
}

export function DashboardStats() {
  const { data: analytics, isLoading } = useQuery<DashboardAnalytics>({
    queryKey: ["/api/analytics/dashboard"],
  });

  const getEncouragingMessage = () => {
    if (!analytics) return "";

    const { messagesThisWeek, totalMessages } = analytics;

    if (messagesThisWeek >= 50) {
      return "🔥 " + messagesThisWeek + " saves this week! You're on fire!";
    } else if (messagesThisWeek >= 20) {
      return "⭐ " + messagesThisWeek + " saves this week! You're a super user!";
    } else if (messagesThisWeek >= 10) {
      return "💪 " + messagesThisWeek + " saves this week! Great momentum!";
    } else if (messagesThisWeek >= 5) {
      return "👍 " + messagesThisWeek + " saves this week! Keep it up!";
    } else if (totalMessages >= 100) {
      return "🎯 " + totalMessages + "+ total saves! You're a power user!";
    } else if (totalMessages >= 50) {
      return "✨ " + totalMessages + " total saves! Great collection!";
    } else if (totalMessages > 0) {
      return "💡 Great start! Keep saving those ideas!";
    } else {
      return "👋 Welcome! Start saving your first message!";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-[#e3cac0]/20 rounded-lg"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#e3cac0]/20 rounded-lg"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-[#e3cac0]/20 rounded-lg"></div>
          <div className="h-64 bg-[#e3cac0]/20 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Format date for display (e.g., "Oct 15")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Prepare chart data
  const timelineData = analytics.messagesOverTime.map(item => ({
    date: formatDate(item.date),
    saves: item.count,
  }));

  const boardsData = analytics.topBoards.map(board => ({
    name: board.name.length > 15 ? board.name.substring(0, 15) + '...' : board.name,
    saves: board.count,
  }));

  return (
    <div className="space-y-6 mb-6">
      {/* Encouraging Message */}
      <div className="text-center py-4 bg-gradient-to-r from-[#b95827]/10 to-[#263d57]/10 rounded-lg border border-[#e3cac0]">
        <p className="text-lg font-semibold text-[#263d57]">
          {getEncouragingMessage()}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Messages */}
        <Card className="bg-white border-[#e3cac0] hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#263d57]/70">
              Total Saves
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-[#b95827]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#263d57]">{analytics.totalMessages}</div>
          </CardContent>
        </Card>

        {/* Total Boards */}
        <Card className="bg-white border-[#e3cac0] hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#263d57]/70">
              Total Boards
            </CardTitle>
            <Hash className="h-4 w-4 text-[#b95827]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#263d57]">{analytics.totalBoards}</div>
          </CardContent>
        </Card>

        {/* Messages This Week */}
        <Card className="bg-white border-[#e3cac0] hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#263d57]/70">
              This Week
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#b95827]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#263d57]">{analytics.messagesThisWeek}</div>
          </CardContent>
        </Card>

        {/* Most Active Board */}
        <Card className="bg-white border-[#e3cac0] hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-[#263d57]/70">
              Most Active
            </CardTitle>
            <Trophy className="h-4 w-4 text-[#b95827]" />
          </CardHeader>
          <CardContent>
            {analytics.mostActiveBoard ? (
              <>
                <div className="text-lg font-bold text-[#263d57] truncate">
                  #{analytics.mostActiveBoard.name}
                </div>
                <p className="text-xs text-[#263d57]/60 mt-1">
                  {analytics.mostActiveBoard.count} saves
                </p>
              </>
            ) : (
              <div className="text-sm text-[#263d57]/60">No boards yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages Over Time Chart */}
        <Card className="bg-white border-[#e3cac0]">
          <CardHeader>
            <CardTitle className="text-base text-[#263d57]">Activity (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3cac0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#263d57" 
                  fontSize={12}
                  tick={{ fill: '#263d57' }}
                />
                <YAxis 
                  stroke="#263d57" 
                  fontSize={12}
                  tick={{ fill: '#263d57' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff2ea', 
                    border: '1px solid #e3cac0',
                    borderRadius: '8px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="saves" 
                  stroke="#b95827" 
                  fill="#b95827" 
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Boards Chart */}
        <Card className="bg-white border-[#e3cac0]">
          <CardHeader>
            <CardTitle className="text-base text-[#263d57]">Top Boards</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={boardsData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e3cac0" />
                <XAxis 
                  type="number" 
                  stroke="#263d57"
                  fontSize={12}
                  tick={{ fill: '#263d57' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#263d57"
                  fontSize={12}
                  tick={{ fill: '#263d57' }}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff2ea', 
                    border: '1px solid #e3cac0',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="saves" 
                  fill="#263d57"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
