import React from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import {List, ListItem, Text, Toggle} from '@ui-kitten/components';

const NotifItem = (props) => {

    const postal = props['item']['location'];
    const notifs_on = props['item']['notifs_on'];

    const notifTitle = `Postal: ${postal}`

    const turnOnNotifsForPost = props['item']['notifOnFunc']
    const turnOffNotifsForPost = props['item']['notifOffFunc']
    

    const toggleNotification = () => {
        if (notifs_on) {
            turnOffNotifsForPost(postal)   
        } else {
            turnOnNotifsForPost(postal)
        }
    }

    const renderToggle = () => (
        <Toggle
            checked={notifs_on}
            onChange={toggleNotification}
        />
    )

    return (
        <ListItem
            title={notifTitle}
            accessoryRight={renderToggle}
        />
    )
}

export default NotifItem