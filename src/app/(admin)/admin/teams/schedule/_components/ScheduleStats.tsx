
import { Card, CardContent } from "@/components/ui/card";

interface ScheduleStatsProps {
  currentWeek: string;
  totalScheduled: number;
  unscheduledCount: number;
}

const ScheduleStats = ({ currentWeek, totalScheduled, unscheduledCount }: ScheduleStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      <Card className="bg-white/60 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{currentWeek}</div>
          <div className="text-sm text-slate-600">Current Week</div>
        </CardContent>
      </Card>
      <Card className="bg-white/60 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totalScheduled}</div>
          <div className="text-sm text-slate-600">Classes Scheduled</div>
        </CardContent>
      </Card>
      <Card className="bg-white/60 backdrop-blur-sm border-white/20">
        <CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{unscheduledCount}</div>
          <div className="text-sm text-slate-600">Need Attention</div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleStats;
