import React, {useState, useEffect, useRef} from 'react';
import * as eva from '@eva-design/eva';
import { ApplicationProvider, Layout, Text, Button, Input, TopNavigation, Divider, List } from '@ui-kitten/components';
import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import VaxLocItem from './VaxLocItem.js';

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

import NumericInput from 'react-native-numeric-input'

// Base url used for fetching voor prullenbakvaccin
const baseURL = "https://www.prullenbakvaccin.nl/";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const [postal, setPostalCode] = useState(null);
  const [cookieInf, setCookieInf] = useState({
    token: null,
    expDate: null,
    maxAge: null
  })
  const [csrf, setCSRF] = useState(null)
  const [locations, setLocations] = useState(null)
  const [notificationInterval, setInterval] = useState(10)
  const notificationListener = useRef();
  const responseListener = useRef();
  
  const getCookie = () => {
    fetch(baseURL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Referer': baseURL,
        'Upgrade-Insecure-Requests': '1',
        'TE': 'Trailers'
    }
    })
    .then((res) => {
      let cookieHeaders = Object.assign({}, ...res.headers.get('set-cookie').split(';').map((kv) => ({[kv.split('=')[0].trim()]: kv.split('=')[1]})))

      setCookieInf({
          token: cookieHeaders['XSRF-TOKEN'],
          expDate: cookieHeaders['expires'],
          maxAge: cookieHeaders['Max-Age'],
        }
      )
    })

    fetch(baseURL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Referer': baseURL,
            'Upgrade-Insecure-Requests': '1',
            'TE': 'Trailers'
        }
    }).then((res) => res.text())
    .then((res) => {
      let re = /<meta name="csrf-token" content="(.*)">/;
      var csrfToken = res.match(re)[1]
      setCSRF(csrfToken)
    });
  }

  getCookie();

  const checkVacTrash = () => {
    
    fetch(baseURL + '#location-selector', {
      method: 'POST',
      headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:88.0) Gecko/20100101 Firefox/88.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': baseURL,
          'DNT': '1',
          'Connection': 'keep-alive',
          'Referer': baseURL,
          'Upgrade-Insecure-Requests': '1',
          'TE': 'Trailers',
          'Cookie': 'XSRF-TOKEN' + cookieInf.token
      },
      body: '_token=' + csrf + '&location=' + postal
    })
    .then((res) => res.text())
    .then((res) => {
      let re = /<h5 class="card-title" id="locatie-[0-9]*">\nLocatie #(.*)\n\((.*)\)\n<br>\n<small>\n([a-zA-Z\s]*|[\n\r]*)<\/small>/g;

      var matches, vaxLocs = [];
      while (matches = re.exec(res)) {
        let locationInfo = {
          '#': matches[1],
          'distance': matches[2],
          'status': matches[3].replace('\n', ' ').trim()
        }
        vaxLocs.push(locationInfo);
      }
      setLocations(vaxLocs)
    });
  }
  
  const updateVaxTrashStatus = () => {
    checkVacTrash()
    console.log('updated vaxtrash status')

    locations.map(async (locInf, i) => {
      if (locInf['status'] !== "Heeft geen vaccins") {
        await sendPushNotification(expoPushToken, locInf);
      }

    })
  }

  const setBackgroundTimer = () => {
    TaskManager.defineTask('CHECK_TRASHVAX_STATUS', () => {
      try {
        updateVaxTrashStatus()
        return locations ? BackgroundFetch.Result.NewData : BackgroundFetch.Result.NoData;
      } catch (error) {
        return BackgroundFetch.Result.Failed;
      }
    })

    BackgroundFetch.registerTaskAsync('CHECK_TRASHVAX_STATUS', {'minimumInterval': 60*notificationInterval})
  }

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    // This listener is fired whenever a notification is received while the app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    // This listener is fired whenever a user taps on or interacts with a notification (works when app is foregrounded, backgrounded, or killed)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  if (locations == null) {
    return (
      <ApplicationProvider {...eva} theme={eva.light}>
        <Layout level='1'>
          <TopNavigation 
            alignment='center'
            title={() => {return (
              <Text category='h4'>TrashVax</Text>
            )}}
            style={{marginTop: 20}}
          />
          <Divider/>
        </Layout>
        <Layout style={{flex: 1, alignItems: 'center', padding: 30}}>
          <Text category='h4'>Fill in your postal code here</Text>
          <Layout style={{flexDirection: 'row', marginVertical: 10}}>
            <Input
              placeholder='eg. 1234'
              onChangeText={(postal) => setPostalCode(postal)}
              onSubmitEditing={checkVacTrash}
            />
            <Button onPress={checkVacTrash}>
              <Text>Search</Text>
            </Button>
          </Layout>
        </Layout>
      </ApplicationProvider>
    );
  } else {
    return (
      <ApplicationProvider {...eva} theme={eva.light}>
        <Layout level='1'>
          <TopNavigation 
            alignment='center'
            title={() => {return (
              <Text category='h4'>TrashVax</Text>
            )}}
            style={{marginTop: 20}}
          />
          <Divider/>
        </Layout>
        <Layout style={{flex: 1, padding: 30}}>
          <Layout style={{alignItems: 'center'}}>
            <Text category='h4'>Fill in your postal code here</Text>
            <Layout style={{flexDirection: 'row', marginVertical: 10, alignItems: 'center'}}>
              <Input
                placeholder='eg. 1234'
                onChangeText={(postal) => setPostalCode(postal)}
                onSubmitEditing={checkVacTrash}
              />
              <Button onPress={checkVacTrash}>
                <Text>Search</Text>
              </Button>
            </Layout>
          </Layout>
          <Text category='h4'>Locations in your region ({locations.length})</Text>
          <Layout style={{marginVertical: 10}}>
            <List
              style={styles.container}
              data={locations}
              renderItem={VaxLocItem}
              ItemSeparatorComponent={Divider}
            >
            </List>
          </Layout>
          <Layout style={{alignItems: 'center', alignSelf: 'center',position: 'absolute', bottom: 0}}>
            <Text category='h6' style={{marginVertical:10}}>Set interval (minutes) for the app to check if there are vaccines available at the above locations</Text>
              <NumericInput value={notificationInterval} onChange={(newInterval) => setInterval(newInterval)}/>
            <Button
              onPress={setBackgroundTimer}
              style={{alignSelf: 'center', width: '100%', marginVertical: 20, height: 50}}
            >
              <Text>Set Notification</Text>
            </Button>
          </Layout>
        </Layout>
      </ApplicationProvider>
    )
  }
}


// Can use this function below, OR use Expo's Push Notification Tool-> https://expo.io/notifications
async function sendPushNotification(expoPushToken, locationInfo) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: 'Vaccine available ' + locationInfo['distance'] + ' from your location',
    body: 'Location ' + locationInfo['#'] + '. Go to www.prullenbakvaccin.nl for more information',
  };

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 200,
  },
});