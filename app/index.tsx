import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors } from '../constants/theme';

/** Entry route — the root navigator immediately redirects based on auth state. */
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
});
