import { FolderOpen, FileText, Image, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import { useStats } from '../hooks/useStats';
import { useProjects } from '../hooks/useProjects';

export default function Analytics() {
  const { data: stats } = useStats();
  const { data: projects = [] } = useProjects();

  const successRate =
    stats && stats.totalProjects > 0
      ? Math.round((stats.completedProjects / stats.totalProjects) * 100)
      : 0;

  return (
    <div className='space-y-6'>
      {/* Static icon classes — no dynamic injection */}
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-3'>
        <Card>
          <div className='flex items-center gap-3'>
            <FolderOpen className='h-8 w-8 text-brand-400' />
            <div>
              <p className='text-xs text-gray-500'>Total Projects</p>
              <p className='text-2xl font-bold text-gray-900'>{stats?.totalProjects ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <CheckCircle className='h-8 w-8 text-green-500' />
            <div>
              <p className='text-xs text-gray-500'>Completed</p>
              <p className='text-2xl font-bold text-gray-900'>{stats?.completedProjects ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <XCircle className='h-8 w-8 text-red-500' />
            <div>
              <p className='text-xs text-gray-500'>Failed</p>
              <p className='text-2xl font-bold text-gray-900'>{stats?.failedProjects ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <FileText className='h-8 w-8 text-brand-500' />
            <div>
              <p className='text-xs text-gray-500'>Pages Documented</p>
              <p className='text-2xl font-bold text-gray-900'>{stats?.totalPages ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <Image className='h-8 w-8 text-orange-500' />
            <div>
              <p className='text-xs text-gray-500'>Screenshots Taken</p>
              <p className='text-2xl font-bold text-gray-900'>{stats?.totalScreenshots ?? 0}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <Clock className='h-8 w-8 text-purple-500' />
            <div>
              <p className='text-xs text-gray-500'>Success Rate</p>
              <p className='text-2xl font-bold text-gray-900'>{successRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Status Overview</CardTitle>
        </CardHeader>
        <div className='space-y-2'>
          {projects.map((p) => (
            <div key={p.id} className='flex items-center justify-between text-sm'>
              <span className='text-gray-700'>{p.name}</span>
              <span className='text-gray-500'>{p.pageCount} pages</span>
            </div>
          ))}
          {projects.length === 0 && (
            <p className='text-sm text-gray-400'>No data available</p>
          )}
        </div>
      </Card>
    </div>
  );
}
