import React from 'react';

export interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const Container: React.FC<ContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`max-w-7xl mx-auto px-4 lg:px-8 ${className}`}>
      {children}
    </div>
  );
};

export default Container;
