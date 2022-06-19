import type { NextPage } from 'next'
import Head from 'next/head'
import styles from '../styles/Home.module.css'
import { Canvas, MeshProps, ThreeEvent } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Mesh } from 'three'

type Vec2 = [number, number]

const INITIAL_ROW_DISTANCE = 5
const ROW_INTERVAL = 2
const PARALLEL_SEAT_COUNT_PER_ROW = [0, 2 * 3, 2 * 3, 2 * 3, 2 * 3, 2 * 3, 2 * 3, 2 * 3, 2 * 3, 2 * 3, 1 * 3]
const CONCENTRIC_SEAT_COUNT_IN_SEGMENT_PER_ROW = [3, 5, 6, 6, 8, 10, 10, 12, 14, 14, 14]
const LAST_NON_SUBSEGMENTED_ROW_INDEX = 2
const SEGMENT_COUNT = 4
const SEAT_RADIUS = 0.5
/**
 * Spacing between concentric seats is based on above parameters and naturally slightly different for each row.
 * For spacing between parallel seats to look right, it has to be close to spacing in concentric rows,
 * so we calculate the spacing in row index 3 (3 just because it seems right) and use that for parallel seats.
 */
const REFERENCE_CONCENTRIC_SEAT_ROW_INDEX = 3

const CONCENTRIC_SEAT_COUNT_IN_SUBSEGMENT_PER_ROW = CONCENTRIC_SEAT_COUNT_IN_SEGMENT_PER_ROW.map(
    (seatCount, rowIndex) => (rowIndex > LAST_NON_SUBSEGMENTED_ROW_INDEX ? seatCount / 2 : seatCount)
)
const CONCENTRIC_SEAT_COUNT_PER_ROW = CONCENTRIC_SEAT_COUNT_IN_SEGMENT_PER_ROW.map(
    (seatCountInSegment) => seatCountInSegment * SEGMENT_COUNT
)
const PARALLEL_SEAT_SPACING =
    (Math.PI * (INITIAL_ROW_DISTANCE + 2 * REFERENCE_CONCENTRIC_SEAT_ROW_INDEX - SEAT_RADIUS) -
        SEAT_RADIUS * 2 * CONCENTRIC_SEAT_COUNT_PER_ROW[REFERENCE_CONCENTRIC_SEAT_ROW_INDEX]) /
    (CONCENTRIC_SEAT_COUNT_PER_ROW[REFERENCE_CONCENTRIC_SEAT_ROW_INDEX] - 1)

let seatPositions: Vec2[] = [
    ...CONCENTRIC_SEAT_COUNT_PER_ROW.flatMap((seatCount, rowIndex) => {
        const rowRadius = INITIAL_ROW_DISTANCE + rowIndex * ROW_INTERVAL
        let rowSeatPositions: Vec2[] = []
        for (let i = 0; i < seatCount; i++) {
            const x = rowRadius * -Math.cos((Math.PI * i) / (seatCount - 1))
            const y = rowRadius * Math.sin((Math.PI * i) / (seatCount - 1))
            rowSeatPositions.push([x, y])
        }
        return rowSeatPositions
    }),
    ...PARALLEL_SEAT_COUNT_PER_ROW.flatMap((seatCount, rowIndex) => {
        const rowRadius = INITIAL_ROW_DISTANCE + rowIndex * ROW_INTERVAL
        let rowSeatPositions: Vec2[] = []
        for (let i = 0; i < seatCount; i++) {
            const isLeftSide = i > 2
            const x = isLeftSide ? -rowRadius : rowRadius
            const y = (2 * SEAT_RADIUS + PARALLEL_SEAT_SPACING) * (isLeftSide ? i - 6 : -1 - i)
            rowSeatPositions.push([x, y])
        }
        return rowSeatPositions
    }),
]

const CONCENTRIC_SEAT_COUNT_TOTAL = CONCENTRIC_SEAT_COUNT_PER_ROW.reduce(
    (sumSoFar, rowSeatCount) => sumSoFar + rowSeatCount
)
const CONCENTRIC_SEAT_INDEX_LOWER_BOUND_PER_ROW = CONCENTRIC_SEAT_COUNT_PER_ROW.reduce<number[]>(
    (accumulator, rowSeatCount) => [...accumulator, (accumulator[accumulator.length - 1] || -1) + rowSeatCount],
    []
)

function translateSeatIndexToSeatNumber(seatIndex: number): number {
    let baseOffset: number
    if (seatIndex >= CONCENTRIC_SEAT_COUNT_TOTAL) {
        // Parallel rows
        const generalRowIndex = Math.floor((seatIndex - CONCENTRIC_SEAT_COUNT_TOTAL) / 3)
        const columnIndex = (seatIndex - CONCENTRIC_SEAT_COUNT_TOTAL) % 3
        let sideRowIndex: number
        if (generalRowIndex % 2) {
            // Left side
            baseOffset = 34
            sideRowIndex = (generalRowIndex - 1) / 2
        } else {
            // Right side
            baseOffset = 472
            sideRowIndex = generalRowIndex / 2
        }
        return baseOffset + 3 * sideRowIndex + columnIndex
    } else {
        // Concentric rows
        baseOffset = 64
        const rowIndex = CONCENTRIC_SEAT_INDEX_LOWER_BOUND_PER_ROW.findIndex(
            (seatIndexLowerBound) => seatIndexLowerBound >= seatIndex
        )
        const seatIndexLowerBoundOfInnerRow = CONCENTRIC_SEAT_INDEX_LOWER_BOUND_PER_ROW[rowIndex - 1] || 0
        const seatCountOfAllInnerRows = seatIndexLowerBoundOfInnerRow ? seatIndexLowerBoundOfInnerRow + 1 : 0
        const seatCountInSegment = CONCENTRIC_SEAT_COUNT_IN_SEGMENT_PER_ROW[rowIndex]
        const seatCountInSubsegment = CONCENTRIC_SEAT_COUNT_IN_SUBSEGMENT_PER_ROW[rowIndex]
        const seatIndexWithinRow = seatIndex - seatCountOfAllInnerRows
        const isInSubsegment =
            rowIndex > LAST_NON_SUBSEGMENTED_ROW_INDEX &&
            seatIndexWithinRow % seatCountInSegment >= Math.ceil(seatCountInSegment / 2)
        const seatIndexWithinSubsegment = seatIndexWithinRow % seatCountInSubsegment
        const segmentIndex = Math.floor(seatIndexWithinRow / seatCountInSegment)
        let seatNumberSegmentationOffset: number
        if (isInSubsegment) {
            seatNumberSegmentationOffset =
                CONCENTRIC_SEAT_COUNT_IN_SUBSEGMENT_PER_ROW.reduce((sumSoFar, seatCount) => sumSoFar + seatCount, 0) +
                CONCENTRIC_SEAT_COUNT_IN_SUBSEGMENT_PER_ROW.slice(LAST_NON_SUBSEGMENTED_ROW_INDEX + 1, rowIndex).reduce(
                    (sumSoFar, seatCount) => sumSoFar + seatCount,
                    0
                )
        } else {
            seatNumberSegmentationOffset = CONCENTRIC_SEAT_COUNT_IN_SUBSEGMENT_PER_ROW.slice(0, rowIndex).reduce(
                (sumSoFar, seatCount) => sumSoFar + seatCount,
                0
            )
        }
        return (
            baseOffset +
            seatNumberSegmentationOffset +
            (CONCENTRIC_SEAT_COUNT_TOTAL / 4) * segmentIndex +
            seatIndexWithinSubsegment
        )
    }
}

/** Memoized mapping of seat index to seat number. */
let SEAT_INDEX_TO_SEAT_NUMBER: number[] = []
for (let i = 0; i < 460; i++) {
    SEAT_INDEX_TO_SEAT_NUMBER[i] = translateSeatIndexToSeatNumber(i)
}

export interface SeatProps {
    onHoverUpdate: (e: ThreeEvent<PointerEvent> | null) => void
}

function Seat({ onHoverUpdate, ...meshProps }: MeshProps & SeatProps): JSX.Element {
    const mesh = useRef<Mesh>()

    const [hover, setHover] = useState(false)

    return (
        <>
            <mesh
                {...meshProps}
                ref={mesh}
                onPointerOver={(e) => {
                    setHover(true)
                    onHoverUpdate(e)
                }}
                onPointerMove={(e) => {
                    onHoverUpdate(e)
                }}
                onPointerOut={() => {
                    setHover(false)
                    onHoverUpdate(null)
                }}
                rotation={[Math.PI / 2, 0, 0]}
            >
                <cylinderGeometry args={[SEAT_RADIUS, SEAT_RADIUS, 0.5, 15]} />
                <meshStandardMaterial color={hover ? 'hotpink' : 'orange'} />
            </mesh>
        </>
    )
}

const Home: NextPage = () => {
    const [hoverCoordinates, setHoverCoordinates] = useState<Vec2 | null>(null)
    const [hoverIndex, setHoverIndex] = useState<number | null>(null)

    return (
        <>
            <div className={styles.container}>
                <main className={styles.main}>
                    <h1 className={styles.title}>
                        <i>Widok.org</i>
                    </h1>
                    <Canvas camera={{ position: [0, 0, 40] }}>
                        <ambientLight intensity={0.4} />
                        <pointLight position={[0, 15, 10]} />
                        {seatPositions.map(([x, y], i) => (
                            <Seat
                                key={i}
                                position={[x, y, 0]}
                                onHoverUpdate={(e) => {
                                    setHoverCoordinates(e && [e.clientX, e.clientY])
                                    setHoverIndex(e ? i : null)
                                }}
                            />
                        ))}
                    </Canvas>
                    <Head>
                        <title>Create Next App</title>
                        <meta name="description" content="Generated by create next app" />
                        <link rel="icon" href="/favicon.ico" />
                    </Head>
                </main>
            </div>
            {hoverCoordinates && hoverIndex !== null && (
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        transform: `translate(calc(${hoverCoordinates[0]}px - 100%), calc(${hoverCoordinates[1]}px - 100%))`,
                        background: 'white',
                        border: '3px solid black',
                        padding: '0.5rem',
                        pointerEvents: 'none',
                    }}
                >
                    <b>Poseł nr {translateSeatIndexToSeatNumber(hoverIndex) || `#${hoverIndex}`}</b>
                </div>
            )}
        </>
    )
}

export default Home
