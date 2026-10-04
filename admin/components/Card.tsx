import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div className={`panel bg-panel border rounded-2xl p-5 sm:p-6 w-full ${className}`} {...props}>
      {children}
    </div>
  );
}

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PageContainer({ children, className = '', ...props }: PageContainerProps) {
  return (
    <div className={`w-full max-w-7xl 2xl:max-w-[1800px] mx-auto space-y-6 ${className}`} {...props}>
      {children}
    </div>
  );
}
