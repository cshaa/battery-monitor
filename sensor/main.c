#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/adc.h"

uint32_t time_ms()
{
    return (time_us_64() / 1000);
}

void led_setup()
{
    gpio_init(PICO_DEFAULT_LED_PIN);
    gpio_set_dir(PICO_DEFAULT_LED_PIN, GPIO_OUT);
}
void led_on()
{
    gpio_put(PICO_DEFAULT_LED_PIN, true);
}
void led_off()
{
    gpio_put(PICO_DEFAULT_LED_PIN, false);
}

void adc_setup()
{
    adc_init();
    adc_gpio_init(26);
    adc_gpio_init(27);
    adc_gpio_init(28);
}
uint adc_measure_count = 0;
uint64_t adc_sum[3] = {0, 0, 0};
const float conversion_factor = 3.3f / (1 << 12);
void adc_measure(uint count)
{
    for (int i = 0; i <= count; i++)
    {
        adc_measure_count += 1;
        for (int chan = 0; chan <= 2; chan++)
        {
            adc_select_input(chan);
            adc_sum[chan] += adc_read();
        }
    }
}
struct AdcResult
{
    float adc[3];
};
struct AdcResult adc_collect()
{
    struct AdcResult result;
    for (int i = 0; i <= 2; i++)
    {
        result.adc[i] = conversion_factor * (float)adc_sum[i] / (float)adc_measure_count;
        adc_sum[i] = 0;
    }

    adc_measure_count = 0;
    return result;
}

char line[1024];
void print_result(struct AdcResult result)
{
    snprintf(line, 1024, "%i,%f,%f,%f", time_ms(), result.adc[0], result.adc[1], result.adc[2]);

    uint64_t checksum = 0;
    for (uint i = 0; line[i] != 0 && i < 1024; i++)
    {
        checksum += line[i];
    }

    printf("%s;%i\n", line, checksum);
}

int main()
{
    stdio_init_all();

    led_setup();
    adc_setup();

    while (true)
    {
        adc_measure(1 << 17);
        print_result(adc_collect());
        led_on();
        adc_measure(1 << 17);
        print_result(adc_collect());
        led_off();
    }
}
