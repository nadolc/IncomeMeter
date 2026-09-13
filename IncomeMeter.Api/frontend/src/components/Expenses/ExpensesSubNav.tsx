import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';

/** Tabs shared by the Expenses, Vehicles and Tax report pages. */
const ExpensesSubNav: React.FC = () => {
  const { t } = useLanguage();
  const items = [
    { to: '/expenses', label: t('expenses.tabs.expenses', 'Expenses'), end: true },
    { to: '/expenses/vehicles', label: t('vehicles.title', 'Vehicles'), end: false },
    { to: '/expenses/tax-report', label: t('taxReport.title', 'Tax year report'), end: false }
  ];

  return (
    <nav className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `px-3 py-1.5 text-sm rounded-md transition-colors ${
              isActive ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
};

export default ExpensesSubNav;
