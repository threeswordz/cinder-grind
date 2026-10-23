type MenuKeyboardEvent = {
  key: string;
  defaultPrevented: boolean;
  nativeEvent: { isComposing: boolean };
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function dismissMobileNavigation(
  event: MenuKeyboardEvent,
  isMobile: boolean,
  isOpen: boolean,
  close: () => void,
) {
  if (!isMobile || !isOpen || event.key !== 'Escape' ||
      event.defaultPrevented || event.nativeEvent.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  close();
}
