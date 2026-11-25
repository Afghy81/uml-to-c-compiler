/* CUSTOM_TEST_HARNESS: End-to-End Verification for Sensor & Controller */
#include <stdio.h>
#include <assert.h>
#include <math.h>
#include "Sensor.h"
#include "Controller.h"
#include "relationships.h"

int main(void) {
    Sensor s;
    Controller ctrl;

    /* 1. Verify Lifecycle Helpers: Sensor_init(&s) & Controller_init(&ctrl) */
    Controller_init(&ctrl);
    Sensor_init(&s);

    assert(fabsf(s.suhu - 0.0f) < 1e-5f);
    assert(s.controller == NULL);
    assert(s.current_state == SENSOR_STATE_IDLE);
    assert(fabsf(ctrl.batas_suhu - 30.0f) < 1e-5f);
    assert(ctrl.alarm_aktif == false);
    printf("[1/5] PASS: Sensor_init(&s) & Controller_init(&ctrl) initialized fields safely.\n");

    /* 2. Verify Method Translation: Sensor_bacaData(&s) */
    Sensor_bacaData(&s);
    assert(fabsf(s.suhu - 27.5f) < 1e-5f);
    printf("[2/5] PASS: Sensor_bacaData(&s) updated s.suhu = %.2f C.\n", s.suhu);

    /* 3. Verify Association Relationship R1 (Sensor -> Controller) */
    Sensor_relate_R1(&s, &ctrl);
    assert(s.controller == &ctrl);
    bool alarm = Controller_cekAmbangBatas(s.controller, s.suhu);
    assert(alarm == false);
    printf("[3/5] PASS: Relationship R1 linked (s.controller == &ctrl), cekAmbangBatas(27.5 <= 30.0) == false.\n");

    /* 4. Verify State Machine & OAL Entry Action (Normal Sampling) */
    s.suhu = 0.0f;
    Sensor_dispatch_event(&s, SENSOR_EVENT_STARTSAMPLING);
    assert(s.current_state == SENSOR_STATE_SAMPLING);
    assert(fabsf(s.suhu - 27.5f) < 1e-5f);
    Sensor_dispatch_event(&s, SENSOR_EVENT_SAMPLEOK);
    assert(s.current_state == SENSOR_STATE_IDLE);
    printf("[4/5] PASS: FSM Idle -> Sampling (OAL entry executed bacaData) -> Idle.\n");

    /* 5. Verify State Machine & OAL Entry Action (Overheat Branch via R1 Navigation) */
    Controller_set_batas_suhu(&ctrl, 25.0f);
    Sensor_dispatch_event(&s, SENSOR_EVENT_STARTSAMPLING);
    /* Since 27.5f > 25.0f, OAL entry action in Sampling self-generates SEN3:Overheat -> OverheatAlert */
    assert(s.current_state == SENSOR_STATE_OVERHEATALERT);
    assert(ctrl.alarm_aktif == true);
    printf("[5/5] PASS: FSM Overheat OAL branch triggered -> State: %s, ctrl.alarm_aktif = true.\n",
           Sensor_state_name(s.current_state));

    printf("[SUCCESS] All End-to-End UML-to-C assertions passed with zero errors!\n");
    return 0;
}
