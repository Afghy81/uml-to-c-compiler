#ifndef MODEL_RELATIONSHIPS_H
#define MODEL_RELATIONSHIPS_H

#include "Controller.h"
#include "Sensor.h"


/* ====================================================================== */
/*                  Relationship Navigation Functions                   */
/* ====================================================================== */

void Sensor_relate_Controller(Sensor_t* src, Controller_t* tgt);
void Sensor_unrelate_Controller(Sensor_t* src, Controller_t* tgt);

#endif /* MODEL_RELATIONSHIPS_H */