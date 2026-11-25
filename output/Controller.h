#ifndef CONTROLLER_H
#define CONTROLLER_H

#include "runtime_c/uml_types.h"
#include "runtime_c/uml_pool.h"


/* ====================================================================== */
/*                      Controller Class Interface                      */
/* ====================================================================== */

typedef struct Controller_s Controller_t;
typedef Controller_t Controller;

// Controller structure
struct Controller_s {
    UML_InstanceHeader_t header;
    float batas_suhu;
    bool alarm_aktif;
};

// Lifecycle functions
void Controller_init(Controller_t* self);
Controller_t* Controller_create(void);
void Controller_destroy(Controller_t* self);

float Controller_get_batas_suhu(const Controller_t* self);
void Controller_set_batas_suhu(Controller_t* self, float value);
bool Controller_get_alarm_aktif(const Controller_t* self);
void Controller_set_alarm_aktif(Controller_t* self, bool value);

// Methods (Operations with explicit self pointer)
bool Controller_cekAmbangBatas(Controller_t* self, float suhu_ukur);

#endif /* CONTROLLER_H */