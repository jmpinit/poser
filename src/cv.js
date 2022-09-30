function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function rotationMatrixToEulerAngles(rotMat) {
  const sy = Math.sqrt(
    rotMat.data64F[0] * rotMat.data64F[0]
    + rotMat.data64F[3] * rotMat.data64F[3],
  );
  const singular = sy < 1e-6;

  let x;
  let y;
  let z;
  if (!singular) {
    x = Math.atan2(rotMat.data64F[7], rotMat.data64F[8]);
    y = Math.atan2(-rotMat.data64F[6], sy);
    z = Math.atan2(rotMat.data64F[3], rotMat.data64F[0]);
  } else {
    x = Math.atan2(-rotMat.data64F[5], rotMat.data64F[4]);
    y = Math.atan2(-rotMat.data64F[6], sy);
    z = 0;
  }

  return cv.matFromArray(1, 3, cv.CV_64F, [x, y, z]);
}

export function solvePnP(
  imageWidth,
  imageHeight,
  sensorWidth,
  sensorHeight,
  focalLength,
  points2d,
  points3d,
  distortionCoeffs,
) {
  const focalLengthXPx = (focalLength * imageWidth) / sensorWidth;
  const focalLengthYPx = (focalLength * imageHeight) / sensorHeight;

  const cameraMat = cv.matFromArray(3, 3, cv.CV_64F, [
    focalLengthXPx, 0, imageWidth / 2.0,
    0, focalLengthYPx, imageHeight / 2.0,
    0, 0, 1,
  ]);

  // TODO: handle distortionCoeffs
  const distortionMat = cv.matFromArray(0, 0, cv.CV_64F, []);

  const pointCount = Math.floor(points2d.length / 2);
  const points2dMat = cv.matFromArray(pointCount, 2, cv.CV_64F, points2d);
  const points3dMat = cv.matFromArray(pointCount, 3, cv.CV_64F, points3d);

  const rotVec = new cv.Mat();
  const transVec = new cv.Mat();
  const success = cv.solvePnP(
    points3dMat,
    points2dMat,
    cameraMat,
    distortionMat,
    rotVec,
    transVec,
    false,
    cv.SOLVEPNP_EPNP,
  );

  if (!success) {
    throw new Error('Failed to find solution');
  }

  const rotMat = new cv.Mat();
  const _jacobian = new cv.Mat();
  cv.Rodrigues(rotVec, rotMat, _jacobian);

  const eulerAngles = rotationMatrixToEulerAngles(rotMat);

  // Calculate the re-projection error
  const reprojPointsMat = cv.matFromArray(pointCount, 2, cv.CV_64F, points2d);
  cv.projectPoints(points3dMat, rotVec, transVec, cameraMat, distortionMat, reprojPointsMat);

  let totalError = 0;
  for (let i = 0; i < pointCount; i += 1) {
    const x1 = points2d[i];
    const y1 = points2d[i + 1];

    const x2 = reprojPointsMat.data64F[i];
    const y2 = reprojPointsMat.data64F[i + 1];

    console.log(x1, y1, x2, y2);

    totalError += distance(x1, y1, x2, y2);
  }

  const error = totalError / pointCount;

  console.log('Re-projected error', error);

  const solution = {
    position: {
      x: transVec.data64F[0],
      y: transVec.data64F[1],
      z: transVec.data64F[2],
    },
    rotation: {
      x: eulerAngles.data64F[0],
      y: eulerAngles.data64F[1],
      z: eulerAngles.data64F[2],
    },
    error,
  };

  eulerAngles.delete();
  _jacobian.delete();
  rotMat.delete();

  transVec.delete();
  rotVec.delete();
  points3dMat.delete();
  points2dMat.delete();
  distortionMat.delete();
  cameraMat.delete();

  return solution;
}
