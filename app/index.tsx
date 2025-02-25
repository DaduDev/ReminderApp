import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { Event } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';

type Reminder = {
  id: string;
  text: string;
  time: string;
  notificationId: string;
};

export default function App(): JSX.Element {
  // List of saved reminders
  const [reminders, setReminders] = useState<Reminder[]>([]);
  // Controls modal visibility for adding a reminder
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  // For the reminder message
  const [newReminderText, setNewReminderText] = useState<string>('');
  // For mobile: store the selected time as a Date
  const [newReminderTime, setNewReminderTime] = useState<Date>(new Date());
  // For web: store the time input string ("HH:MM")
  const [webTime, setWebTime] = useState<string>('');

  useEffect(() => {
    requestPermissions();
    loadReminders();
  }, []);

  // Request notification permissions (skip on web)
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Notifications need permission to work.');
      }
    }
  };

  // Load reminders from AsyncStorage
  const loadReminders = async () => {
    try {
      const storedReminders = await AsyncStorage.getItem('reminders');
      if (storedReminders !== null) {
        setReminders(JSON.parse(storedReminders));
      }
    } catch (error) {
      console.error('Failed to load reminders', error);
    }
  };

  // Save reminders to AsyncStorage
  const saveReminders = async (remindersArray: Reminder[]) => {
    try {
      await AsyncStorage.setItem('reminders', JSON.stringify(remindersArray));
    } catch (error) {
      console.error('Failed to save reminders', error);
    }
  };

  // Schedule a daily notification with the reminder message (skip on web)
  const scheduleNotificationForReminder = async (
    selectedTime: Date,
    message: string
  ): Promise<string> => {
    if (Platform.OS === 'web') {
      console.warn('Notifications are not available on web. Skipping scheduling.');
      return 'web-dummy-notification-id';
    }
    const trigger = new Date(selectedTime);
    trigger.setSeconds(0);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        // Only the message text is displayed in the notification.
        title: message,
        body: '',
        data: { customData: 'Reminder notification' },
        sound: 'default',
      },
      trigger: { hour: trigger.getHours(), minute: trigger.getMinutes(), repeats: true },
    });
    return notificationId;
  };

  // Add a reminder, schedule its notification, and store it offline
  const addReminder = async (selectedTime: Date, message: string) => {
    const notificationId = await scheduleNotificationForReminder(selectedTime, message);
    const newReminder: Reminder = {
      id: Date.now().toString(),
      text: message,
      time: selectedTime.toISOString(),
      notificationId,
    };

    const updatedReminders = [...reminders, newReminder];
    setReminders(updatedReminders);
    await saveReminders(updatedReminders);
    Alert.alert(
      'Reminder Set',
      `Reminder "${message}" set for ${selectedTime.toLocaleTimeString()}.`
    );
  };

  // Remove a reminder and cancel its notification (if on native)
  const removeReminder = async (reminderId: string) => {
    const reminderToRemove = reminders.find(r => r.id === reminderId);
    if (reminderToRemove && Platform.OS !== 'web') {
      await Notifications.cancelScheduledNotificationAsync(reminderToRemove.notificationId);
    }
    const updatedReminders = reminders.filter(r => r.id !== reminderId);
    setReminders(updatedReminders);
    await saveReminders(updatedReminders);
  };

  // Called when user taps Save in the add reminder modal.
  const handleSaveReminder = () => {
    if (!newReminderText.trim()) {
      Alert.alert('Input Required', 'Please enter a reminder text.');
      return;
    }
    let selectedTime: Date;
    if (Platform.OS === 'web') {
      if (!webTime) {
        Alert.alert('Input Required', 'Please choose a time.');
        return;
      }
      const [hours, minutes] = webTime.split(':').map(Number);
      selectedTime = new Date();
      selectedTime.setHours(hours);
      selectedTime.setMinutes(minutes);
      selectedTime.setSeconds(0);
      setWebTime('');
    } else {
      selectedTime = newReminderTime;
    }
    addReminder(selectedTime, newReminderText);
    setNewReminderText('');
    setModalVisible(false);
  };

  // Render each reminder card in the list, displaying both text and time.
  const renderReminder = ({ item }: { item: Reminder }) => {
    const displayTime = new Date(item.time).toLocaleTimeString();
    return (
      <View style={styles.reminderItem}>
        <View>
          <Text style={styles.reminderText}>{item.text}</Text>
          <Text style={styles.reminderTime}>{displayTime}</Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removeReminder(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#FFDEE9', '#B5FFFC']} style={styles.gradient}>
      <View style={styles.container}>
        <Text style={styles.title}>Offline Reminder App</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>Add Reminder</Text>
        </TouchableOpacity>

        <Text style={styles.subtitle}>Your Reminders:</Text>
        {reminders.length === 0 ? (
          <Text style={styles.noReminderText}>No reminders set.</Text>
        ) : (
          <FlatList
            data={reminders}
            keyExtractor={(item) => item.id}
            renderItem={renderReminder}
          />
        )}

        {/* Modal for adding a reminder */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Add Reminder</Text>
              
              {/* Reminder Text Input */}
              <TextInput
                style={styles.textInput}
                placeholder="Enter reminder text"
                value={newReminderText}
                onChangeText={setNewReminderText}
              />

              {/* Time Input */}
              {Platform.OS === 'web' ? (
                <input
                  type="time"
                  value={webTime}
                  onChange={(e) => setWebTime(e.target.value)}
                  style={styles.webInput as any}
                />
              ) : (
                <DateTimePicker
                  value={newReminderTime}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={(event: Event, selectedTime?: Date) => {
                    if (selectedTime) {
                      setNewReminderTime(selectedTime);
                    }
                  }}
                />
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setNewReminderText('');
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveReminder}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginTop: 40,
    marginBottom: 10,
    textAlign: 'center',
  },
  noReminderText: {
    textAlign: 'center',
    color: 'gray',
    fontSize: 16,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    marginVertical: 8,
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  reminderText: {
    fontSize: 18,
    color: '#555',
  },
  reminderTime: {
    fontSize: 14,
    color: '#999',
  },
  deleteButton: {
    backgroundColor: '#E53935',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  // Modal styling
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    marginHorizontal: 30,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
  },
  webInput: {
    fontSize: 16,
    padding: 10,
    borderRadius: 5,
    border: '1px solid #ccc',
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  cancelButton: {
    backgroundColor: '#E53935',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
