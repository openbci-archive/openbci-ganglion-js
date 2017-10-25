export interface EEGReading {
    electrode: number; // 0 to 3
    timestamp: number;
    samples: number[]; // 2 samples each time
}

export interface XYZ {
    x: number;
    y: number;
    z: number;
}

export interface AccelerometerData {
    samples: XYZ[];
}

export interface GanglionControlResponse {
    rc: number;
    [key: string]: string | number;
}

export interface GanglionDeviceInfo extends GanglionControlResponse {
    fw: string;
    hw: string;
}
