import { Observable } from 'rxjs/Observable';

import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/takeUntil';

export function decodeResponse(bytes: Uint8Array) {
	return new TextDecoder().decode(bytes);
}

export function encodeCommand(cmd: string) {
	const encoded = new TextEncoder('utf-8').encode(`${cmd}`);
	return encoded;
}

export async function observableCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic) {
	await characteristic.startNotifications();
	const disconnected = Observable.fromEvent(characteristic.service!.device, 'gattserverdisconnected');
	return Observable.fromEvent(characteristic, 'characteristicvaluechanged')
		.takeUntil(disconnected)
		.map((event: Event) => (event.target as BluetoothRemoteGATTCharacteristic).value as DataView);
}
