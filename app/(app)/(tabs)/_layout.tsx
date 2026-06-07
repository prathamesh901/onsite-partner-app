import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Colors, Typography } from '../../../constants/theme';
import { useAuth } from '../../../context/AuthContext';

export default function AppTabsLayout() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarLabelStyle: { ...Typography.caption, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="kiosks"
        options={{
          title: 'Kiosks',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="supplies"
        options={{
          title: 'Supplies',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
      {/* Admin tab — visible only for admin role. Hidden (not just disabled) otherwise. */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
