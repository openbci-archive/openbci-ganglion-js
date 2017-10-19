import { Observable } from 'rxjs/Observable';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import 'rxjs/add/observable/merge';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/first';
import 'rxjs/add/operator/share';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/toPromise';

import { EEGReading, TelemetryData, AccelerometerData, GyroscopeData, XYZ, MuseControlResponse, MuseDeviceInfo } from './lib/muse-interfaces';
import { parseControl, decodeEEGSamples, parseTelemetry, parseAccelerometer, parseGyroscope } from './lib/muse-parse';
import { encodeCommand, decodeResponse, observableCharacteristic } from './lib/muse-utils';

export { zipSamples, EEGSample } from './lib/zip-samples';
export { EEGReading, TelemetryData, AccelerometerData, GyroscopeData, XYZ, MuseControlResponse };

export const SIMBLEE_SERVICE = 0xfe84;
/** Simblee */
const CONTROL_CHARACTERISTIC = '2d30c083f39f4ce6923f3484ea480596';
const EEG_CHARACTERISTIC = '2d30c082f39f4ce6923f3484ea480596';

// These names match the characteristics defined in EEG_CHARACTERISTICS above
export const channelNames = [
    'TP9',
    'AF7',
    'AF8',
    'TP10',
    'AUX'
];

export class MuseClient {
    private gatt: BluetoothRemoteGATTServer | null = null;
    private controlChar: BluetoothRemoteGATTCharacteristic;
    private eegCharacteristics: BluetoothRemoteGATTCharacteristic[];

    public enableAux = false;
    public deviceName: string | null = '';
    public connectionStatus = new BehaviorSubject<boolean>(false);
    public rawControlData: Observable<string>;
    public controlResponses: Observable<MuseControlResponse>;
    public accelerometerData: Observable<AccelerometerData>;
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

        // Battery
        const telemetryCharacteristic = await service.getCharacteristic(TELEMETRY_CHARACTERISTIC);
        this.telemetryData = (await observableCharacteristic(telemetryCharacteristic))
            .map(parseTelemetry);

        // Gyroscope
        const gyroscopeCharacteristic = await service.getCharacteristic(GYROSCOPE_CHARACTERISTIC);
        this.gyroscopeData = (await observableCharacteristic(gyroscopeCharacteristic))
            .map(parseGyroscope);

        // Accelerometer
        const eegCharacteristic = await service.getCharacteristic(EEG_CHARACTERISTIC);
        this.eegData = (await observableCharacteristic(eegCharacteristic))
            .map(parseEEGData);

        // EEG
        this.eegCharacteristics = [];
        const eegObservables = [];
        const channelCount = this.enableAux ? EEG_CHARACTERISTICS.length : 4;
        for (let index = 0; index < channelCount; index++) {
            let characteristicId = EEG_CHARACTERISTICS[index];
            const eegChar = await service.getCharacteristic(characteristicId);
            eegObservables.push(
                (await observableCharacteristic(eegChar)).map(data => {
                    return {
                        electrode: index,
                        timestamp: data.getUint16(0),
                        samples: decodeEEGSamples(new Uint8Array(data.buffer).subarray(2))
                    };
                }));
            this.eegCharacteristics.push(eegChar);
        }
        this.eegReadings = Observable.merge(...eegObservables);
        this.connectionStatus.next(true);
    }

    async sendCommand(cmd: string) {
        await this.controlChar.writeValue((encodeCommand(cmd)));
    }

    async start() {
        // Subscribe to egg characteristics
        await this.pause();
        // Select preset number 20
        await this.controlChar.writeValue(encodeCommand('p20'));
        await this.controlChar.writeValue(encodeCommand('s'));
        await this.resume();
    }

    async pause() {
        await this.sendCommand('h');
    }

    async resume() {
        await this.sendCommand('d');
    }

    async deviceInfo() {
        const resultListener = this.controlResponses.filter(r => !!r.fw).take(1).toPromise();
        await this.sendCommand('v1');
        return resultListener as Promise<MuseDeviceInfo>;
    }

    disconnect() {
        if (this.gatt) {
            this.gatt.disconnect();
            this.connectionStatus.next(false);
        }
    }
}
