import { Alert, AlertButton, Platform } from 'react-native';

// Android alerts render at most 3 buttons and silently drop the rest, so longer
// menus are paged there: two choices plus "More options…" until everything fits.
export function showActionMenu(title: string, message: string, actions: AlertButton[]) {
  if (Platform.OS !== 'android') {
    Alert.alert(title, message, actions);
    return;
  }

  const choices = actions.filter((a) => a.style !== 'cancel');
  const cancel = actions.find((a) => a.style === 'cancel') ?? { text: 'Cancel', style: 'cancel' };

  if (choices.length <= 2) {
    Alert.alert(title, message, [...choices, cancel], { cancelable: true });
    return;
  }

  Alert.alert(
    title,
    message,
    [
      choices[0],
      choices[1],
      { text: 'More options…', onPress: () => showActionMenu(title, message, [...choices.slice(2), cancel]) },
    ],
    { cancelable: true }
  );
}
