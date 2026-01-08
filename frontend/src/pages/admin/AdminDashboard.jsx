import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useLanguage } from '../../App';
import AdminLayout from './AdminLayout';
import { ShoppingBag, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { apiUrl, token, isAuthenticated } = useApp();
  const { t } = useLanguage();
  
  const [stats, setStats] = useState({
    today_orders: 0,
    today_sales: 0,
    pending_count: 0,
    currency: 'KWD',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
      return;
    }
    loadStats();
  }, [isAuthenticated]);

  const loadStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: t("Today's Orders", 'طلبات اليوم'),
      value: stats.today_orders,
      icon: ShoppingBag,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: t("Today's Sales", 'مبيعات اليوم'),
      value: `${stats.today_sales.toFixed(3)} ${stats.currency}`,
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: t('Pending Orders', 'الطلبات المعلقة'),
      value: stats.pending_count,
      icon: Clock,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      onClick: () => navigate('/admin/orders'),
    },
    {
      title: t('Avg. Order Value', 'متوسط قيمة الطلب'),
      value: stats.today_orders > 0 
        ? `${(stats.today_sales / stats.today_orders).toFixed(3)} ${stats.currency}`
        : `0.000 ${stats.currency}`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <AdminLayout title={t('Dashboard', 'لوحة التحكم')}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <Card
              key={index}
              className={`bg-card border-border/50 ${stat.onClick ? 'cursor-pointer hover:border-primary/50' : ''}`}
              onClick={stat.onClick}
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1 ltr-nums">{stat.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className="bg-card border-border/50 cursor-pointer hover:border-primary/50"
            onClick={() => navigate('/admin/orders')}
          >
            <CardHeader>
              <CardTitle className="text-lg">{t('View Orders', 'عرض الطلبات')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('Manage incoming orders and update statuses', 'إدارة الطلبات الواردة وتحديث الحالات')}
              </p>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border/50 cursor-pointer hover:border-primary/50"
            onClick={() => navigate('/admin/menu')}
          >
            <CardHeader>
              <CardTitle className="text-lg">{t('Menu Manager', 'إدارة القائمة')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('Add or edit categories, items, and modifiers', 'إضافة أو تعديل الفئات والأصناف والإضافات')}
              </p>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border/50 cursor-pointer hover:border-primary/50"
            onClick={() => navigate('/admin/reports')}
          >
            <CardHeader>
              <CardTitle className="text-lg">{t('View Reports', 'عرض التقارير')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {t('Sales reports and analytics', 'تقارير المبيعات والتحليلات')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
