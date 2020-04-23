import * as Jackin from 'jackin';


export class MockGPIO
    extends Jackin.GPIO
{
    private pin: Jackin.Pin;
    private mode = Jackin.Mode.read;
    private value = false;
    private pullup = Jackin.PullupMode.floating;

    constructor(
        pin: Jackin.Pin
    )
    {
        super();
        this.pin = pin;
    }


    getPins(): Jackin.Pin[]
    {
        return [ this.pin ];
    }


    setMode(
        mode: Jackin.Mode
    ): Promise<void>
    {
        this.mode = mode;
        return new Promise( (resolve, reject) => {
            resolve();
        });
    }

    getMode(
    ): Promise<Jackin.Mode>
    {
        return new Promise( (resolve, reject) => {
            resolve( this.mode );
        });
    }

    setValue(
        val: boolean
    ): Promise<void>
    {
        this.value = val;
        return new Promise( (resolve, reject) => {
            resolve();
        });
    }

    getValue(
    ): Promise<boolean>
    {
        return new Promise( (resolve, reject) => {
            resolve( this.value );
        });
    }

    setPullup(
        mode: Jackin.PullupMode
    ): Promise<void>
    {
        this.pullup = mode;
        return new Promise( (resolve, reject) => {
            resolve();
        });
    }

    getPullup(
    ): Promise<Jackin.PullupMode>
    {
        return new Promise( (resolve, reject) => {
            resolve( this.pullup );
        });
    }
}

export class Device
    implements Jackin.Device
{
    private pins_by_num: Jackin.Pin[];
    private pins: Jackin.Pins;


    constructor()
    {
        let power5v_pin = {
            note: ""
            ,power: null
        };
        power5v_pin.power = new Jackin.Power( 5.0 );

        let gnd_pin = {
            note: ""
            ,power: null
        };
        gnd_pin.power = new Jackin.Power( 0 );

        let gpio1 = {
            note: "" 
            ,gpio: null
        };
        gpio1.gpio = new MockGPIO( gpio1 );

        let gpio2 = {
            note: "" 
            ,gpio: null
        };
        gpio2.gpio = new MockGPIO( gpio2 );


        this.pins_by_num = [
            power5v_pin
            ,gnd_pin
            ,gpio1
            ,gpio2
        ];

        this.pins = {
            pins: [
                [ this.pins_by_num[0] ,this.pins_by_num[1] ]
                ,[ this.pins_by_num[2] ,this.pins_by_num[3] ]
            ]
        };
    }

    maxPinNum(): number
    {
        return this.pins_by_num.length;
    }

    getPins(): Jackin.Pins
    {
        return this.pins;
    }

    getPin(
        pin: number
    ): Jackin.Pin
    {
        const actual_pin = pin - 1;
        return this.pins_by_num[ actual_pin ];
    }
}
