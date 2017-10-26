import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/observable/merge';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/toPromise';

import { EEGReading, AccelerometerData, GanglionControlResponse, GanglionDeviceInfo } from './lib/ganglion-interfaces';
import { parseControl, decodeEEGSamples, parseAccelerometer } from './lib/ganglion-parse';
import { encodeCommand, decodeResponse, observableCharacteristic } from './lib/ganglion-utils';

export { zipSamples, EEGSample } from './lib/zip-samples';
export { EEGReading, AccelerometerData, GanglionControlResponse };

export const SIMBLEE_SERVICE = 0xfe84;
/** Simblee */
const CONTROL_CHARACTERISTIC = '2d30c083f39f4ce6923f3484ea480596';
const EEG_CHARACTERISTIC = '2d30c082f39f4ce6923f3484ea480596';

// These names match the characteristics defined in EEG_CHARACTERISTICS above
export const channelNames = [
    '1',
    '2',
    '3',
    '4'
];

export class GanglionClient {
    private gatt: BluetoothRemoteGATTServer | null = null;
    private controlChar: BluetoothRemoteGATTCharacteristic;
    private eegCharacteristics: BluetoothRemoteGATTCharacteristic[];

    public enableAux = false;
    public deviceName: string | null = '';
    public connectionStatus = new BehaviorSubject<boolean>(false);
    public rawControlData: Observable<string>;
    public controlResponses: Observable<GanglionControlResponse>;
    public eegReadings: Observable<EEGReading>;

    async connect(gatt?: BluetoothRemoteGATTServer) {
        if (gatt) {
            this.gatt = gatt;
        } else {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [SIMBLEE_SERVICE] }]
            });
            this.gatt = await device.gatt!.connect();
        }
        this.deviceName = this.gatt.device.name || null;

        const service = await this.gatt.getPrimaryService(SIMBLEE_SERVICE);
        Observable.fromEvent<void>(this.gatt.device, 'gattserverdisconnected').first().subscribe(() => {
            this.gatt = null;
            this.connectionStatus.next(false);
        });

        // Control
        this.controlChar = await service.getCharacteristic(CONTROL_CHARACTERISTIC);
        this.rawControlData = (await observableCharacteristic(this.controlChar))
            .map(data => decodeResponse(new Uint8Array(data.buffer)))
            .share();
        this.controlResponses = parseControl(this.rawControlData);

        // EEG
        const decompressedSamples = new Array(3);
        for (let i = 0; i < 3; i++) {
            decompressedSamples[i] = [0, 0, 0, 0];
        }
        const accelArray = [0, 0, 0];
        const eegCharacteristic = await service.getCharacteristic(EEG_CHARACTERISTIC);
        this.eegReadings = (await observableCharacteristic(eegCharacteristic))
            .map(data => {
                return decodeEEGSamples(data, decompressedSamples, accelArray);
            });

        this.connectionStatus.next(true);
    }

    async sendCommand(cmd: string) {
        await this.controlChar.writeValue((encodeCommand(cmd)));
    }

    async start() {
        // Subscribe to egg characteristics
        await this.pause();
        await this.sendCommand('b');
        await this.resume();
    }

    async pause() {
        await this.sendCommand('s');
    }

    async resume() {
        await this.sendCommand('b');
    }

    async deviceInfo() {
        const resultListener = this.controlResponses.filter(r => !!r.fw).take(1).toPromise();
        await this.sendCommand('v');
        return resultListener as Promise<MuseDeviceInfo>;
    }

    disconnect() {
        if (this.gatt) {
            this.gatt.disconnect();
            this.connectionStatus.next(false);
        }
    }
}
