import type { Theme } from '../contexts/ThemeContext';

/**
 * 테마에 따른 클래스 이름을 반환하는 유틸리티 함수들
 */

export function getCardBgClass(theme: Theme): string {
  return theme === 'dark' ? 'bg-gray-800' : 'bg-white';
}

export function getCardTextClass(theme: Theme): string {
  return theme === 'dark' ? 'text-gray-200' : 'text-gray-700';
}

export function getCardTextSecondaryClass(theme: Theme): string {
  return theme === 'dark' ? 'text-gray-300' : 'text-gray-500';
}

export function getCardTextMutedClass(theme: Theme): string {
  return theme === 'dark' ? 'text-gray-400' : 'text-gray-500';
}

export function getCardTitleClass(theme: Theme): string {
  return theme === 'dark' ? 'text-white' : 'text-gray-900';
}

export function getSkeletonBgClass(theme: Theme): string {
  return theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200';
}

export function getBorderClass(theme: Theme): string {
  return theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
}





