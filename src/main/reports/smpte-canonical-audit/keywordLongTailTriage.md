# Keyword long-tail triage — the 684 terms failing `validate`

> Generated: 2026-07-14T15:41:41.129Z
> The validator enforces controlled-vocab-only keywords, so every term below must
> land in one bucket. **Proposal only — nothing written.** Edit any verdict, then I apply.

## Buckets
| verdict | terms | effect |
|---|---:|---|
| ACRONYM | 99 | fix casing → add canonical form to vocab |
| FOLD | 0 | map to an existing vocab term |
| DROP | 39 | remove from the docs' keywords[] |
| ADD | 546 | new controlledKeywords entry |

## 🗑️ DROP — remove from docs (39)

| term | docs | verdict | why |
|---|---:|---|---|
| `Actor` | 2 | **—** | too generic to be a facet |
| `Asynchronous` | 2 | **—** | too generic to be a facet |
| `Broadcast` | 2 | **—** | too generic to be a facet |
| `Calibration` | 2 | **—** | too generic to be a facet |
| `Containers` | 2 | **—** | too generic to be a facet |
| `Flexibility` | 2 | **—** | too generic to be a facet |
| `Galileo` | 2 | **—** | too generic to be a facet |
| `Hybrid` | 2 | **—** | too generic to be a facet |
| `Jamming` | 2 | **—** | too generic to be a facet |
| `Live Act` | 2 | **—** | too generic to be a facet |
| `Mezzanine` | 2 | **—** | too generic to be a facet |
| `Orchestration` | 2 | **—** | too generic to be a facet |
| `Parallax` | 2 | **—** | too generic to be a facet |
| `Production` | 2 | **—** | too generic to be a facet |
| `Reference Signal` | 2 | **—** | too generic to be a facet |
| `Remote Control` | 2 | **—** | too generic to be a facet |
| `Rendering` | 2 | **—** | too generic to be a facet |
| `Resilience` | 2 | **—** | too generic to be a facet |
| `Software` | 2 | **—** | too generic to be a facet |
| `Spoofing` | 2 | **—** | too generic to be a facet |
| `Stage` | 2 | **—** | too generic to be a facet |
| `Stereo` | 2 | **—** | too generic to be a facet |
| `Timing` | 2 | **—** | too generic to be a facet |
| `3d Simulation In Football Analysis` | 1 | **—** | author sentence-fragment, not a topic |
| `Atsc 3.0 and MPEG Media Transport (mmt)` | 1 | **—** | author sentence-fragment, not a topic |
| `Auditory Envelopment Is Stimulating To Young and Old People Alike` | 1 | **—** | author sentence-fragment, not a topic |
| `Data Distribution As A Service (ddaas)` | 1 | **—** | author sentence-fragment, not a topic |
| `Hearing Is The Earliest and Most Formative Sense` | 1 | **—** | author sentence-fragment, not a topic |
| `In The Good Old Days` | 1 | **—** | author sentence-fragment, not a topic |
| `Listening Level On Portable Platforms` | 1 | **—** | author sentence-fragment, not a topic |
| `Loudness To Dialog Ratio (ldr)` | 1 | **—** | author sentence-fragment, not a topic |
| `Movie Theatres Are Reliable Places To Enjoy Auditory Envelopment` | 1 | **—** | author sentence-fragment, not a topic |
| `Music Production For Social Listening In Movie Theatres` | 1 | **—** | author sentence-fragment, not a topic |
| `Pixel Count Doesn't Necessarily Equal Resolution` | 1 | **—** | author sentence-fragment, not a topic |
| `Test Materials Intended For Observation` | 1 | **—** | author sentence-fragment, not a topic |
| `Universal Test Patterns For Sdr and Hd` | 1 | **—** | author sentence-fragment, not a topic |
| `Video End To End Optimization` | 1 | **—** | author sentence-fragment, not a topic |
| `Vision and Other Senses Build On Hearing` | 1 | **—** | author sentence-fragment, not a topic |
| `Voxiumai™` | 1 | **—** | trademark / product name |

## 🔠 ACRONYM — casing fix (99)

| term | docs | verdict | why |
|---|---:|---|---|
| `3D-RECONSTRUCTION` | 2 | **3d-Reconstruction** | casing artifact — uppercase hyphenated phrase |
| `Arq` | 2 | **ARQ** | miscased acronym |
| `C2pa` | 2 | **C2PA** | miscased acronym |
| `Catena` | 2 | **Catena** | miscased acronym |
| `Cuda` | 2 | **CUDA** | miscased acronym |
| `Daap` | 2 | **DAAP** | miscased acronym |
| `Daniel2` | 2 | **Daniel2** | miscased acronym |
| `Dnxgx` | 2 | **DNxGX** | miscased acronym |
| `Dnxhr` | 2 | **DNxHR** | miscased acronym |
| `FILM-LOOK` | 2 | **Film-Look** | casing artifact — uppercase hyphenated phrase |
| `Genai` | 2 | **GenAI** | miscased acronym |
| `Gltf` | 2 | **glTF** | miscased acronym |
| `Gnss` | 2 | **GNSS** | miscased acronym |
| `Gps` | 2 | **GPS** | miscased acronym |
| `Hap` | 2 | **HAP** | miscased acronym |
| `HIGH-FIDELITY` | 2 | **High-Fidelity** | casing artifact — uppercase hyphenated phrase |
| `Hlg` | 2 | **HLG** | miscased acronym |
| `Hls` | 2 | **HLS** | miscased acronym |
| `JPEG` | 2 | **JPEG** | miscased acronym |
| `LOW-LATENCY` | 2 | **Low-Latency** | casing artifact — uppercase hyphenated phrase |
| `Moqt` | 2 | **MoQT** | miscased acronym |
| `Notchlc` | 2 | **NotchLC** | miscased acronym |
| `Olpf` | 2 | **OLPF** | miscased acronym |
| `Osnma` | 2 | **OSNMA** | miscased acronym |
| `Rdo` | 2 | **RDO** | miscased acronym |
| `S35` | 2 | **S35** | miscased acronym |
| `Scte` | 2 | **SCTE** | miscased acronym |
| `Smpte` | 2 | **SMPTE** | miscased acronym |
| `Stltp` | 2 | **STLTP** | miscased acronym |
| `Tdc` | 2 | **TDC** | miscased acronym |
| `Ucx` | 2 | **UCX** | miscased acronym |
| `Vmaf` | 2 | **VMAF** | miscased acronym |
| `Xs` | 2 | **XS** | miscased acronym |
| `Abr` | 1 | **ABR** | short single token — likely acronym (confirm) |
| `Aom` | 1 | **AOM** | short single token — likely acronym (confirm) |
| `Ar` | 1 | **AR** | short single token — likely acronym (confirm) |
| `Avid` | 1 | **AVID** | short single token — likely acronym (confirm) |
| `Canvas` | 1 | **CANVAS** | short single token — likely acronym (confirm) |
| `Cie` | 1 | **CIE** | short single token — likely acronym (confirm) |
| `Cna` | 1 | **CNA** | short single token — likely acronym (confirm) |
| `Cpp` | 1 | **CPP** | short single token — likely acronym (confirm) |
| `Cve` | 1 | **CVE** | short single token — likely acronym (confirm) |
| `Dchd` | 1 | **DCHD** | short single token — likely acronym (confirm) |
| `Dmf` | 1 | **DMF** | miscased acronym |
| `Dnxhd` | 1 | **DNXHD** | short single token — likely acronym (confirm) |
| `Dnxho` | 1 | **DNXHO** | short single token — likely acronym (confirm) |
| `Ebu` | 1 | **EBU** | miscased acronym |
| `Ffmpeg` | 1 | **FFMPEG** | short single token — likely acronym (confirm) |
| `Gaming` | 1 | **GAMING** | short single token — likely acronym (confirm) |
| `H266` | 1 | **H266** | short single token — likely acronym (confirm) |
| `Has` | 1 | **HAS** | miscased acronym |
| `Helios` | 1 | **HELIOS** | short single token — likely acronym (confirm) |
| `Hiring` | 1 | **HIRING** | short single token — likely acronym (confirm) |
| `Icvfx` | 1 | **ICVFX** | short single token — likely acronym (confirm) |
| `Intel` | 1 | **INTEL** | short single token — likely acronym (confirm) |
| `Ipmx` | 1 | **IPMX** | short single token — likely acronym (confirm) |
| `Itm` | 1 | **ITM** | short single token — likely acronym (confirm) |
| `JPEG-XS` | 1 | **Jpeg-Xs** | casing artifact — uppercase hyphenated phrase |
| `Lidar` | 1 | **LIDAR** | short single token — likely acronym (confirm) |
| `Llama2` | 1 | **LLAMA2** | short single token — likely acronym (confirm) |
| `Mcs` | 1 | **MCS** | short single token — likely acronym (confirm) |
| `Meshes` | 1 | **MESHES** | short single token — likely acronym (confirm) |
| `Mets` | 1 | **METS** | short single token — likely acronym (confirm) |
| `Moq` | 1 | **MOQ** | short single token — likely acronym (confirm) |
| `Mr` | 1 | **MR** | short single token — likely acronym (confirm) |
| `MV-HEVC` | 1 | **Mv-Hevc** | casing artifact — uppercase hyphenated phrase |
| `Naba` | 1 | **NABA** | short single token — likely acronym (confirm) |
| `Neqr` | 1 | **NEQR** | short single token — likely acronym (confirm) |
| `Ner` | 1 | **NER** | short single token — likely acronym (confirm) |
| `News` | 1 | **NEWS** | short single token — likely acronym (confirm) |
| `Nic` | 1 | **NIC** | short single token — likely acronym (confirm) |
| `Nisq` | 1 | **NISQ** | short single token — likely acronym (confirm) |
| `Nmos` | 1 | **NMOS** | short single token — likely acronym (confirm) |
| `Ntr` | 1 | **NTR** | short single token — likely acronym (confirm) |
| `Onetbb` | 1 | **ONETBB** | short single token — likely acronym (confirm) |
| `Osa` | 1 | **OSA** | short single token — likely acronym (confirm) |
| `Osha` | 1 | **OSHA** | short single token — likely acronym (confirm) |
| `Qoe` | 1 | **QoE** | miscased acronym |
| `Quic` | 1 | **QUIC** | short single token — likely acronym (confirm) |
| `Rag` | 1 | **RAG** | short single token — likely acronym (confirm) |
| `Remi` | 1 | **REMI** | short single token — likely acronym (confirm) |
| `Remote` | 1 | **REMOTE** | short single token — likely acronym (confirm) |
| `Rocos` | 1 | **ROCOS** | short single token — likely acronym (confirm) |
| `Sdp` | 1 | **SDP** | short single token — likely acronym (confirm) |
| `Sdr` | 1 | **SDR** | short single token — likely acronym (confirm) |
| `Sgai` | 1 | **SGAI** | short single token — likely acronym (confirm) |
| `Slog` | 1 | **SLOG** | short single token — likely acronym (confirm) |
| `Sls` | 1 | **SLS** | short single token — likely acronym (confirm) |
| `ST-2110` | 1 | **St-2110** | casing artifact — uppercase hyphenated phrase |
| `St2022` | 1 | **ST2022** | short single token — likely acronym (confirm) |
| `St2110` | 1 | **ST2110** | short single token — likely acronym (confirm) |
| `Tm` | 1 | **TM** | short single token — likely acronym (confirm) |
| `Unity` | 1 | **UNITY** | short single token — likely acronym (confirm) |
| `Vc6` | 1 | **VC6** | short single token — likely acronym (confirm) |
| `Vod` | 1 | **VOD** | short single token — likely acronym (confirm) |
| `Vp9` | 1 | **VP9** | miscased acronym |
| `Vpu` | 1 | **VPU** | miscased acronym |
| `Vr` | 1 | **VR** | miscased acronym |
| `Vvc` | 1 | **VVC** | miscased acronym |

## 🔀 FOLD — map to existing vocab (0)

| term | docs | verdict | why |
|---|---:|---|---|

## ✅ ADD — new vocab entries (546)

| term | docs | verdict | why |
|---|---:|---|---|
| `2/3-inch` | 2 | **2/3-inch** | reusable topic (2 docs) |
| `AI Translation` | 2 | **AI Translation** | reusable topic (2 docs) |
| `Amwa Nmos Specification` | 2 | **Amwa Nmos Specification** | reusable topic (2 docs) |
| `Atsc 3.0` | 2 | **Atsc 3.0** | reusable topic (2 docs) |
| `Augmented Reality` | 2 | **Augmented Reality** | reusable topic (2 docs) |
| `Automatic Speech Recognition` | 2 | **Automatic Speech Recognition** | reusable topic (2 docs) |
| `Band Spectrum` | 2 | **Band Spectrum** | reusable topic (2 docs) |
| `Broadcast Security` | 2 | **Broadcast Security** | reusable topic (2 docs) |
| `Cinematography` | 2 | **Cinematography** | reusable topic (2 docs) |
| `Cmos Imagers` | 2 | **Cmos Imagers** | reusable topic (2 docs) |
| `Color Matching` | 2 | **Color Matching** | reusable topic (2 docs) |
| `Computer Vision` | 2 | **Computer Vision** | reusable topic (2 docs) |
| `Content Provenance` | 2 | **Content Provenance** | reusable topic (2 docs) |
| `Content Steering` | 2 | **Content Steering** | reusable topic (2 docs) |
| `Content Supply Chain` | 2 | **Content Supply Chain** | reusable topic (2 docs) |
| `Control Plane` | 2 | **Control Plane** | reusable topic (2 docs) |
| `Cultural Adaptation` | 2 | **Cultural Adaptation** | reusable topic (2 docs) |
| `Cybersecurity` | 2 | **Cybersecurity** | reusable topic (2 docs) |
| `Data Architecture` | 2 | **Data Architecture** | reusable topic (2 docs) |
| `Data Centers` | 2 | **Data Centers** | reusable topic (2 docs) |
| `Data Governance` | 2 | **Data Governance** | reusable topic (2 docs) |
| `Data Mesh` | 2 | **Data Mesh** | reusable topic (2 docs) |
| `Digital Cinema Facility Node` | 2 | **Digital Cinema Facility Node** | reusable topic (2 docs) |
| `Digital Cinema System` | 2 | **Digital Cinema System** | reusable topic (2 docs) |
| `Digital Program Insertion` | 2 | **Digital Program Insertion** | reusable topic (2 docs) |
| `Display Management` | 2 | **Display Management** | reusable topic (2 docs) |
| `Distributed Transcoding` | 2 | **Distributed Transcoding** | reusable topic (2 docs) |
| `Dynamic Adaptive Streaming Over HTTP (dash)` | 2 | **Dynamic Adaptive Streaming Over HTTP (dash)** | reusable topic (2 docs) |
| `Dynamic Media Infrastructure` | 2 | **Dynamic Media Infrastructure** | reusable topic (2 docs) |
| `Ebu Dynamic Media Facility (dmf)` | 2 | **Ebu Dynamic Media Facility (dmf)** | reusable topic (2 docs) |
| `Ebu Tech 3371` | 2 | **Ebu Tech 3371** | reusable topic (2 docs) |
| `Edge Computing` | 2 | **Edge Computing** | reusable topic (2 docs) |
| `Event Location` | 2 | **Event Location** | reusable topic (2 docs) |
| `Fast Metadata Framework` | 2 | **Fast Metadata Framework** | reusable topic (2 docs) |
| `Film Grain Quality Assessment` | 2 | **Film Grain Quality Assessment** | reusable topic (2 docs) |
| `Film Grain Repetitive Pattern Detection` | 2 | **Film Grain Repetitive Pattern Detection** | reusable topic (2 docs) |
| `Global Shutter` | 2 | **Global Shutter** | reusable topic (2 docs) |
| `Gpu Acceleration` | 2 | **Gpu Acceleration** | reusable topic (2 docs) |
| `Holdover Oscillator` | 2 | **Holdover Oscillator** | reusable topic (2 docs) |
| `HTTP Adaptive Streaming (has)` | 2 | **HTTP Adaptive Streaming (has)** | reusable topic (2 docs) |
| `Image Search Engine Optimization` | 2 | **Image Search Engine Optimization** | reusable topic (2 docs) |
| `Immersive Video` | 2 | **Immersive Video** | reusable topic (2 docs) |
| `IP-BASED Media Solutions` | 2 | **IP-BASED Media Solutions** | reusable topic (2 docs) |
| `Knowledge Graphs` | 2 | **Knowledge Graphs** | reusable topic (2 docs) |
| `Kubernetes` | 2 | **Kubernetes** | reusable topic (2 docs) |
| `Large Language Models` | 2 | **Large Language Models** | reusable topic (2 docs) |
| `Linear Streaming` | 2 | **Linear Streaming** | reusable topic (2 docs) |
| `Low Complexity` | 2 | **Low Complexity** | reusable topic (2 docs) |
| `Low Power` | 2 | **Low Power** | reusable topic (2 docs) |
| `Media Microservices` | 2 | **Media Microservices** | reusable topic (2 docs) |
| `Media Transport Protocol` | 2 | **Media Transport Protocol** | reusable topic (2 docs) |
| `Metaverse` | 2 | **Metaverse** | reusable topic (2 docs) |
| `Motion Capture` | 2 | **Motion Capture** | reusable topic (2 docs) |
| `Network Emulation` | 2 | **Network Emulation** | reusable topic (2 docs) |
| `Neural Radiance Fields` | 2 | **Neural Radiance Fields** | reusable topic (2 docs) |
| `Perceptual Shot Matching` | 2 | **Perceptual Shot Matching** | reusable topic (2 docs) |
| `Picture Quality` | 2 | **Picture Quality** | reusable topic (2 docs) |
| `Pl Mount` | 2 | **Pl Mount** | reusable topic (2 docs) |
| `PLAYBACK-SIDE Context` | 2 | **PLAYBACK-SIDE Context** | reusable topic (2 docs) |
| `Power Consumption` | 2 | **Power Consumption** | reusable topic (2 docs) |
| `Protocol Performance Measurement` | 2 | **Protocol Performance Measurement** | reusable topic (2 docs) |
| `Qoe (quality Of Experience)` | 2 | **Qoe (quality Of Experience)** | reusable topic (2 docs) |
| `Resource Management` | 2 | **Resource Management** | reusable topic (2 docs) |
| `Responsible AI` | 2 | **Responsible AI** | reusable topic (2 docs) |
| `Shared Memory` | 2 | **Shared Memory** | reusable topic (2 docs) |
| `Software Latencies` | 2 | **Software Latencies** | reusable topic (2 docs) |
| `SOFTWARE-DEFINED Media Facilities` | 2 | **SOFTWARE-DEFINED Media Facilities** | reusable topic (2 docs) |
| `Speech Recognition` | 2 | **Speech Recognition** | reusable topic (2 docs) |
| `St 2067-70:2024` | 2 | **St 2067-70:2024** | reusable topic (2 docs) |
| `Subjective Study` | 2 | **Subjective Study** | reusable topic (2 docs) |
| `Supplemental Enhancement Information (sei)` | 2 | **Supplemental Enhancement Information (sei)** | reusable topic (2 docs) |
| `Transfer Function` | 2 | **Transfer Function** | reusable topic (2 docs) |
| `Tunable Bitrates` | 2 | **Tunable Bitrates** | reusable topic (2 docs) |
| `Tv API` | 2 | **Tv API** | reusable topic (2 docs) |
| `Tv Settings` | 2 | **Tv Settings** | reusable topic (2 docs) |
| `Universal Ui` | 2 | **Universal Ui** | reusable topic (2 docs) |
| `Unreal Engine` | 2 | **Unreal Engine** | reusable topic (2 docs) |
| `Vector Search` | 2 | **Vector Search** | reusable topic (2 docs) |
| `Versatile Supplemental Enhancement Information (vsei)` | 2 | **Versatile Supplemental Enhancement Information (vsei)** | reusable topic (2 docs) |
| `Video Generation` | 2 | **Video Generation** | reusable topic (2 docs) |
| `Video Production` | 2 | **Video Production** | reusable topic (2 docs) |
| `Virtual Reference` | 2 | **Virtual Reference** | reusable topic (2 docs) |
| `Virtualized Media Facilities` | 2 | **Virtualized Media Facilities** | reusable topic (2 docs) |
| `Visually Lossless` | 2 | **Visually Lossless** | reusable topic (2 docs) |
| `Volumetric Video` | 2 | **Volumetric Video** | reusable topic (2 docs) |
| `Zero Trust Architecture` | 2 | **Zero Trust Architecture** | reusable topic (2 docs) |
| `360° Video` | 1 | **360° Video** | topic (1 doc) |
| `3d Gaussian Splatting` | 1 | **3d Gaussian Splatting** | topic (1 doc) |
| `3d Lut` | 1 | **3d Lut** | topic (1 doc) |
| `3d Rendering` | 1 | **3d Rendering** | topic (1 doc) |
| `3d Scene Reconstruction` | 1 | **3d Scene Reconstruction** | topic (1 doc) |
| `3d Stereoscopic Video` | 1 | **3d Stereoscopic Video** | topic (1 doc) |
| `3d Vertigo Syndrome` | 1 | **3d Vertigo Syndrome** | topic (1 doc) |
| `3d Video Streaming` | 1 | **3d Video Streaming** | topic (1 doc) |
| `3d Video Transport` | 1 | **3d Video Transport** | topic (1 doc) |
| `5g` | 1 | **5g** | topic (1 doc) |
| `Accessibility In Media` | 1 | **Accessibility In Media** | topic (1 doc) |
| `Adaptive Bitrate Streaming` | 1 | **Adaptive Bitrate Streaming** | topic (1 doc) |
| `adm/s-adm` | 1 | **adm/s-adm** | topic (1 doc) |
| `Advanced Vector Extensions (avx)` | 1 | **Advanced Vector Extensions (avx)** | topic (1 doc) |
| `Affective Touch Hypothesis` | 1 | **Affective Touch Hypothesis** | topic (1 doc) |
| `Agentic AI` | 1 | **Agentic AI** | topic (1 doc) |
| `AI Captioning` | 1 | **AI Captioning** | topic (1 doc) |
| `AI Ethics` | 1 | **AI Ethics** | topic (1 doc) |
| `AI Manipulation` | 1 | **AI Manipulation** | topic (1 doc) |
| `Ai-assisted Film Production` | 1 | **Ai-assisted Film Production** | topic (1 doc) |
| `AI-ASSISTED Newsroom` | 1 | **AI-ASSISTED Newsroom** | topic (1 doc) |
| `Ai-driven Media` | 1 | **Ai-driven Media** | topic (1 doc) |
| `Ai-generated Content` | 1 | **Ai-generated Content** | topic (1 doc) |
| `Ai-native Networking` | 1 | **Ai-native Networking** | topic (1 doc) |
| `Alpha Channel` | 1 | **Alpha Channel** | topic (1 doc) |
| `Ambient` | 1 | **Ambient** | topic (1 doc) |
| `Ambient Viewing Environment` | 1 | **Ambient Viewing Environment** | topic (1 doc) |
| `Analog Test Patterns` | 1 | **Analog Test Patterns** | topic (1 doc) |
| `Animation` | 1 | **Animation** | topic (1 doc) |
| `Anomaly Detection` | 1 | **Anomaly Detection** | topic (1 doc) |
| `API` | 1 | **API** | topic (1 doc) |
| `Apple Vison Pro` | 1 | **Apple Vison Pro** | topic (1 doc) |
| `Ar Graphics` | 1 | **Ar Graphics** | topic (1 doc) |
| `Artistic Intent` | 1 | **Artistic Intent** | topic (1 doc) |
| `Asynchronous Processing` | 1 | **Asynchronous Processing** | topic (1 doc) |
| `Audience Aware` | 1 | **Audience Aware** | topic (1 doc) |
| `Audio Description` | 1 | **Audio Description** | topic (1 doc) |
| `Auditory Envelopment` | 1 | **Auditory Envelopment** | topic (1 doc) |
| `Augmented Reality Graphics` | 1 | **Augmented Reality Graphics** | topic (1 doc) |
| `Auto-regressive Film Grain Synthesis` | 1 | **Auto-regressive Film Grain Synthesis** | topic (1 doc) |
| `Availability` | 1 | **Availability** | topic (1 doc) |
| `Availability Zones` | 1 | **Availability Zones** | topic (1 doc) |
| `Background` | 1 | **Background** | topic (1 doc) |
| `Baseband Video` | 1 | **Baseband Video** | topic (1 doc) |
| `Baseline` | 1 | **Baseline** | topic (1 doc) |
| `Best Of Breed Choices` | 1 | **Best Of Breed Choices** | topic (1 doc) |
| `Betting` | 1 | **Betting** | topic (1 doc) |
| `Bias Mitigation and Safety` | 1 | **Bias Mitigation and Safety** | topic (1 doc) |
| `Blender` | 1 | **Blender** | topic (1 doc) |
| `Botnets` | 1 | **Botnets** | topic (1 doc) |
| `Bpp-bits Per Pixel` | 1 | **Bpp-bits Per Pixel** | topic (1 doc) |
| `Brightness` | 1 | **Brightness** | topic (1 doc) |
| `Broadcast Accessibility` | 1 | **Broadcast Accessibility** | topic (1 doc) |
| `Broadcast Applications` | 1 | **Broadcast Applications** | topic (1 doc) |
| `Broadcast Automation` | 1 | **Broadcast Automation** | topic (1 doc) |
| `Broadcast Centers` | 1 | **Broadcast Centers** | topic (1 doc) |
| `Broadcast Events` | 1 | **Broadcast Events** | topic (1 doc) |
| `Broadcast Graphics` | 1 | **Broadcast Graphics** | topic (1 doc) |
| `Camara Tracking` | 1 | **Camara Tracking** | topic (1 doc) |
| `Camera Response Function (crf)` | 1 | **Camera Response Function (crf)** | topic (1 doc) |
| `Camera To Cloud` | 1 | **Camera To Cloud** | topic (1 doc) |
| `Case Study` | 1 | **Case Study** | topic (1 doc) |
| `Categorical Observers` | 1 | **Categorical Observers** | topic (1 doc) |
| `Cdn Switching` | 1 | **Cdn Switching** | topic (1 doc) |
| `Channel Ranking` | 1 | **Channel Ranking** | topic (1 doc) |
| `Channel Surfing` | 1 | **Channel Surfing** | topic (1 doc) |
| `Children's Movies` | 1 | **Children's Movies** | topic (1 doc) |
| `Clickable Object` | 1 | **Clickable Object** | topic (1 doc) |
| `Clickable Video` | 1 | **Clickable Video** | topic (1 doc) |
| `Clip (contrastive Language-image Pre-training)` | 1 | **Clip (contrastive Language-image Pre-training)** | topic (1 doc) |
| `Cloud Computing` | 1 | **Cloud Computing** | topic (1 doc) |
| `Cloud-native` | 1 | **Cloud-native** | topic (1 doc) |
| `Cloud-native Media` | 1 | **Cloud-native Media** | topic (1 doc) |
| `Code-switching` | 1 | **Code-switching** | topic (1 doc) |
| `Coding Efficiency` | 1 | **Coding Efficiency** | topic (1 doc) |
| `Color Appearance` | 1 | **Color Appearance** | topic (1 doc) |
| `Color Correction` | 1 | **Color Correction** | topic (1 doc) |
| `Color Pipelines` | 1 | **Color Pipelines** | topic (1 doc) |
| `Color Science` | 1 | **Color Science** | topic (1 doc) |
| `Color Scope` | 1 | **Color Scope** | topic (1 doc) |
| `Color Volume` | 1 | **Color Volume** | topic (1 doc) |
| `Color Workflows` | 1 | **Color Workflows** | topic (1 doc) |
| `Color-close Applications` | 1 | **Color-close Applications** | topic (1 doc) |
| `COLOR-MATCHING Functions` | 1 | **COLOR-MATCHING Functions** | topic (1 doc) |
| `Colorfulness` | 1 | **Colorfulness** | topic (1 doc) |
| `Common Media Common Data` | 1 | **Common Media Common Data** | topic (1 doc) |
| `Composable Transformation Pipelines` | 1 | **Composable Transformation Pipelines** | topic (1 doc) |
| `Compounding AI Workflows` | 1 | **Compounding AI Workflows** | topic (1 doc) |
| `Computational Efficiency` | 1 | **Computational Efficiency** | topic (1 doc) |
| `Compute` | 1 | **Compute** | topic (1 doc) |
| `Congestion Control` | 1 | **Congestion Control** | topic (1 doc) |
| `Connectsdk` | 1 | **Connectsdk** | topic (1 doc) |
| `Containerization` | 1 | **Containerization** | topic (1 doc) |
| `Containerized` | 1 | **Containerized** | topic (1 doc) |
| `Containerized Media Services` | 1 | **Containerized Media Services** | topic (1 doc) |
| `Content Creator` | 1 | **Content Creator** | topic (1 doc) |
| `Content Curation` | 1 | **Content Curation** | topic (1 doc) |
| `Content Delivery Network` | 1 | **Content Delivery Network** | topic (1 doc) |
| `Content Delivery Network (cdn)` | 1 | **Content Delivery Network (cdn)** | topic (1 doc) |
| `Content Distribution` | 1 | **Content Distribution** | topic (1 doc) |
| `Content Retrieval` | 1 | **Content Retrieval** | topic (1 doc) |
| `Content-adaptive Encoding` | 1 | **Content-adaptive Encoding** | topic (1 doc) |
| `Context Engine` | 1 | **Context Engine** | topic (1 doc) |
| `CONTEXT-ADAPTIVE Content Presentation` | 1 | **CONTEXT-ADAPTIVE Content Presentation** | topic (1 doc) |
| `Contextualizer` | 1 | **Contextualizer** | topic (1 doc) |
| `Contrast` | 1 | **Contrast** | topic (1 doc) |
| `Contrast Sensitive Function` | 1 | **Contrast Sensitive Function** | topic (1 doc) |
| `Contribution Over The Internet` | 1 | **Contribution Over The Internet** | topic (1 doc) |
| `Control Room Automation` | 1 | **Control Room Automation** | topic (1 doc) |
| `Corporate Av` | 1 | **Corporate Av** | topic (1 doc) |
| `Cost Savings` | 1 | **Cost Savings** | topic (1 doc) |
| `Creative Intent Preservation` | 1 | **Creative Intent Preservation** | topic (1 doc) |
| `Creativity` | 1 | **Creativity** | topic (1 doc) |
| `Cultural Heritage` | 1 | **Cultural Heritage** | topic (1 doc) |
| `Data As A Product` | 1 | **Data As A Product** | topic (1 doc) |
| `Data Integration` | 1 | **Data Integration** | topic (1 doc) |
| `Data Pipelines` | 1 | **Data Pipelines** | topic (1 doc) |
| `Data Security and Privacy` | 1 | **Data Security and Privacy** | topic (1 doc) |
| `Deep Learning` | 1 | **Deep Learning** | topic (1 doc) |
| `Deepfakes` | 1 | **Deepfakes** | topic (1 doc) |
| `Definition Of Dialog Level` | 1 | **Definition Of Dialog Level** | topic (1 doc) |
| `Depth Estimation` | 1 | **Depth Estimation** | topic (1 doc) |
| `Depth Of Field` | 1 | **Depth Of Field** | topic (1 doc) |
| `Descriptive Video` | 1 | **Descriptive Video** | topic (1 doc) |
| `Device Configuration` | 1 | **Device Configuration** | topic (1 doc) |
| `Digital Packages` | 1 | **Digital Packages** | topic (1 doc) |
| `Digital Watermark` | 1 | **Digital Watermark** | topic (1 doc) |
| `Digitization` | 1 | **Digitization** | topic (1 doc) |
| `Display Deployment` | 1 | **Display Deployment** | topic (1 doc) |
| `Display Device` | 1 | **Display Device** | topic (1 doc) |
| `Display Settings` | 1 | **Display Settings** | topic (1 doc) |
| `Distributed Architecture` | 1 | **Distributed Architecture** | topic (1 doc) |
| `Distributed Media Systems` | 1 | **Distributed Media Systems** | topic (1 doc) |
| `Distributed Routing` | 1 | **Distributed Routing** | topic (1 doc) |
| `Dubbing` | 1 | **Dubbing** | topic (1 doc) |
| `Dubbing Of Movies` | 1 | **Dubbing Of Movies** | topic (1 doc) |
| `Dynamic Media Facilities` | 1 | **Dynamic Media Facilities** | topic (1 doc) |
| `Dynamic Media Facility` | 1 | **Dynamic Media Facility** | topic (1 doc) |
| `Dynamic Queues` | 1 | **Dynamic Queues** | topic (1 doc) |
| `Dynamic Range` | 1 | **Dynamic Range** | topic (1 doc) |
| `Ebucore` | 1 | **Ebucore** | topic (1 doc) |
| `Edge Caching` | 1 | **Edge Caching** | topic (1 doc) |
| `Education` | 1 | **Education** | topic (1 doc) |
| `Efficiency` | 1 | **Efficiency** | topic (1 doc) |
| `Egress Cost Reduction` | 1 | **Egress Cost Reduction** | topic (1 doc) |
| `Election Coverage` | 1 | **Election Coverage** | topic (1 doc) |
| `Emotional Accuracy` | 1 | **Emotional Accuracy** | topic (1 doc) |
| `Emotional Sound` | 1 | **Emotional Sound** | topic (1 doc) |
| `Energy Consumption` | 1 | **Energy Consumption** | topic (1 doc) |
| `Energy Efficiency` | 1 | **Energy Efficiency** | topic (1 doc) |
| `Energy Monitoring` | 1 | **Energy Monitoring** | topic (1 doc) |
| `Entertainment Cybersecurity` | 1 | **Entertainment Cybersecurity** | topic (1 doc) |
| `Entity Extraction` | 1 | **Entity Extraction** | topic (1 doc) |
| `ENVIRONMENT-DRIVEN Rendering` | 1 | **ENVIRONMENT-DRIVEN Rendering** | topic (1 doc) |
| `Esports Broadcasting` | 1 | **Esports Broadcasting** | topic (1 doc) |
| `Eurovision 2024` | 1 | **Eurovision 2024** | topic (1 doc) |
| `Evaluation Metrics` | 1 | **Evaluation Metrics** | topic (1 doc) |
| `Event Driven Architecture` | 1 | **Event Driven Architecture** | topic (1 doc) |
| `Existing Infrastructure` | 1 | **Existing Infrastructure** | topic (1 doc) |
| `Extended Reality` | 1 | **Extended Reality** | topic (1 doc) |
| `Extended Reality (xr)` | 1 | **Extended Reality (xr)** | topic (1 doc) |
| `Facial Recognition` | 1 | **Facial Recognition** | topic (1 doc) |
| `Failure-tolerant Control Plane` | 1 | **Failure-tolerant Control Plane** | topic (1 doc) |
| `Faiss (facebook AI Similarity Search)` | 1 | **Faiss (facebook AI Similarity Search)** | topic (1 doc) |
| `False Color` | 1 | **False Color** | topic (1 doc) |
| `Faster Than Realtime` | 1 | **Faster Than Realtime** | topic (1 doc) |
| `Fbb- Frame Buffer Bandwidth` | 1 | **Fbb- Frame Buffer Bandwidth** | topic (1 doc) |
| `FEW-SHOT Learning` | 1 | **FEW-SHOT Learning** | topic (1 doc) |
| `Fhd- Full High Definition` | 1 | **Fhd- Full High Definition** | topic (1 doc) |
| `Film Color` | 1 | **Film Color** | topic (1 doc) |
| `Film Grain` | 1 | **Film Grain** | topic (1 doc) |
| `Film Making` | 1 | **Film Making** | topic (1 doc) |
| `Final Sample` | 1 | **Final Sample** | topic (1 doc) |
| `Focal Length` | 1 | **Focal Length** | topic (1 doc) |
| `Fragmented Mp4` | 1 | **Fragmented Mp4** | topic (1 doc) |
| `Frame Accurate Control` | 1 | **Frame Accurate Control** | topic (1 doc) |
| `Framelock` | 1 | **Framelock** | topic (1 doc) |
| `Fraunhofer` | 1 | **Fraunhofer** | topic (1 doc) |
| `Free Viewpoint` | 1 | **Free Viewpoint** | topic (1 doc) |
| `FREE-VIEWPOINT Rendering` | 1 | **FREE-VIEWPOINT Rendering** | topic (1 doc) |
| `Gamut Boundary` | 1 | **Gamut Boundary** | topic (1 doc) |
| `Gamut Rings` | 1 | **Gamut Rings** | topic (1 doc) |
| `Gaussian Splatting` | 1 | **Gaussian Splatting** | topic (1 doc) |
| `Generative Media` | 1 | **Generative Media** | topic (1 doc) |
| `GET-CI` | 1 | **GET-CI** | topic (1 doc) |
| `Global Dimming` | 1 | **Global Dimming** | topic (1 doc) |
| `Global Shared-memory Mesh` | 1 | **Global Shared-memory Mesh** | topic (1 doc) |
| `GPT-4` | 1 | **GPT-4** | topic (1 doc) |
| `Gpu Computing` | 1 | **Gpu Computing** | topic (1 doc) |
| `Graphics` | 1 | **Graphics** | topic (1 doc) |
| `Guidelines` | 1 | **Guidelines** | topic (1 doc) |
| `H.264, AVC` | 1 | **H.264, AVC** | topic (1 doc) |
| `Hdr- High Dynamic Range` | 1 | **Hdr- High Dynamic Range** | topic (1 doc) |
| `Head Mounded Display` | 1 | **Head Mounded Display** | topic (1 doc) |
| `Hearing Loss` | 1 | **Hearing Loss** | topic (1 doc) |
| `High Availability` | 1 | **High Availability** | topic (1 doc) |
| `High Efficiency Video Coding (hevc)` | 1 | **High Efficiency Video Coding (hevc)** | topic (1 doc) |
| `HTTP Streaming` | 1 | **HTTP Streaming** | topic (1 doc) |
| `Human Impact` | 1 | **Human Impact** | topic (1 doc) |
| `Hybrid Image` | 1 | **Hybrid Image** | topic (1 doc) |
| `Hybrid Production` | 1 | **Hybrid Production** | topic (1 doc) |
| `Hyper Content Personalization` | 1 | **Hyper Content Personalization** | topic (1 doc) |
| `IETF` | 1 | **IETF** | topic (1 doc) |
| `Image Depth and Parallax` | 1 | **Image Depth and Parallax** | topic (1 doc) |
| `Image Resolution` | 1 | **Image Resolution** | topic (1 doc) |
| `Images As Test Materials` | 1 | **Images As Test Materials** | topic (1 doc) |
| `Immersive Media` | 1 | **Immersive Media** | topic (1 doc) |
| `Immersive Replays` | 1 | **Immersive Replays** | topic (1 doc) |
| `Immersive Standards` | 1 | **Immersive Standards** | topic (1 doc) |
| `Inclusivity` | 1 | **Inclusivity** | topic (1 doc) |
| `Industry Architecture` | 1 | **Industry Architecture** | topic (1 doc) |
| `Infrastructure Lifecycle` | 1 | **Infrastructure Lifecycle** | topic (1 doc) |
| `Inner Frustum` | 1 | **Inner Frustum** | topic (1 doc) |
| `Instagram` | 1 | **Instagram** | topic (1 doc) |
| `Intel Xeon` | 1 | **Intel Xeon** | topic (1 doc) |
| `Interactive Video` | 1 | **Interactive Video** | topic (1 doc) |
| `Interlingual Emotion Transfer` | 1 | **Interlingual Emotion Transfer** | topic (1 doc) |
| `Interlingual Transfer` | 1 | **Interlingual Transfer** | topic (1 doc) |
| `INTERNET-OF-THINGS (iot)` | 1 | **INTERNET-OF-THINGS (iot)** | topic (1 doc) |
| `Interop Points` | 1 | **Interop Points** | topic (1 doc) |
| `Intopix` | 1 | **Intopix** | topic (1 doc) |
| `Inverse Tone Mapping` | 1 | **Inverse Tone Mapping** | topic (1 doc) |
| `Invisible Watermark` | 1 | **Invisible Watermark** | topic (1 doc) |
| `IP Control` | 1 | **IP Control** | topic (1 doc) |
| `IP Media Workflows` | 1 | **IP Media Workflows** | topic (1 doc) |
| `IP-BASED Workflows` | 1 | **IP-BASED Workflows** | topic (1 doc) |
| `ISO 226` | 1 | **ISO 226** | topic (1 doc) |
| `iso/iec` | 1 | **iso/iec** | topic (1 doc) |
| `It Equipment` | 1 | **It Equipment** | topic (1 doc) |
| `Iterative Model Development` | 1 | **Iterative Model Development** | topic (1 doc) |
| `ITU-T` | 1 | **ITU-T** | topic (1 doc) |
| `Jammertest` | 1 | **Jammertest** | topic (1 doc) |
| `Keyframe-centric Processing` | 1 | **Keyframe-centric Processing** | topic (1 doc) |
| `Language Processing` | 1 | **Language Processing** | topic (1 doc) |
| `Large Language Model` | 1 | **Large Language Model** | topic (1 doc) |
| `Large Language Models (llm)` | 1 | **Large Language Models (llm)** | topic (1 doc) |
| `Large Sensors` | 1 | **Large Sensors** | topic (1 doc) |
| `Latency` | 1 | **Latency** | topic (1 doc) |
| `Latency Budgets and Deployment` | 1 | **Latency Budgets and Deployment** | topic (1 doc) |
| `Led 3d Displays` | 1 | **Led 3d Displays** | topic (1 doc) |
| `Led Panels` | 1 | **Led Panels** | topic (1 doc) |
| `Led Processing` | 1 | **Led Processing** | topic (1 doc) |
| `Led Screens` | 1 | **Led Screens** | topic (1 doc) |
| `Led Wall` | 1 | **Led Wall** | topic (1 doc) |
| `Lg Tv Management` | 1 | **Lg Tv Management** | topic (1 doc) |
| `Linear Tv` | 1 | **Linear Tv** | topic (1 doc) |
| `Lip Sync` | 1 | **Lip Sync** | topic (1 doc) |
| `Listening Level In Production` | 1 | **Listening Level In Production** | topic (1 doc) |
| `Live Automatic Captions` | 1 | **Live Automatic Captions** | topic (1 doc) |
| `Live Media Production` | 1 | **Live Media Production** | topic (1 doc) |
| `Live Sky` | 1 | **Live Sky** | topic (1 doc) |
| `Live Translation` | 1 | **Live Translation** | topic (1 doc) |
| `Live Video Workflows` | 1 | **Live Video Workflows** | topic (1 doc) |
| `LIVE-PRODUCTION Workflow` | 1 | **LIVE-PRODUCTION Workflow** | topic (1 doc) |
| `LLMs` | 1 | **LLMs** | topic (1 doc) |
| `Load Testing` | 1 | **Load Testing** | topic (1 doc) |
| `Localization` | 1 | **Localization** | topic (1 doc) |
| `LONG-TERM Preservation` | 1 | **LONG-TERM Preservation** | topic (1 doc) |
| `Loss Function` | 1 | **Loss Function** | topic (1 doc) |
| `Loudness-to-dialog Ratio` | 1 | **Loudness-to-dialog Ratio** | topic (1 doc) |
| `Loudspeaker Calibration` | 1 | **Loudspeaker Calibration** | topic (1 doc) |
| `Low-latency Media` | 1 | **Low-latency Media** | topic (1 doc) |
| `Luminance Qualified` | 1 | **Luminance Qualified** | topic (1 doc) |
| `Machine Translation` | 1 | **Machine Translation** | topic (1 doc) |
| `Media & Entertainment` | 1 | **Media & Entertainment** | topic (1 doc) |
| `Media and Entertainment` | 1 | **Media and Entertainment** | topic (1 doc) |
| `Media Archives` | 1 | **Media Archives** | topic (1 doc) |
| `Media Authenticity` | 1 | **Media Authenticity** | topic (1 doc) |
| `Media Database` | 1 | **Media Database** | topic (1 doc) |
| `Media Exchange` | 1 | **Media Exchange** | topic (1 doc) |
| `Media Facilities` | 1 | **Media Facilities** | topic (1 doc) |
| `Media Pipeline Modernization` | 1 | **Media Pipeline Modernization** | topic (1 doc) |
| `Media Production` | 1 | **Media Production** | topic (1 doc) |
| `Media Servers` | 1 | **Media Servers** | topic (1 doc) |
| `Media Supply Chain` | 1 | **Media Supply Chain** | topic (1 doc) |
| `Megapixel` | 1 | **Megapixel** | topic (1 doc) |
| `Metadata Tracking` | 1 | **Metadata Tracking** | topic (1 doc) |
| `Metadata-guided Audio Mga` | 1 | **Metadata-guided Audio Mga** | topic (1 doc) |
| `Metahuman` | 1 | **Metahuman** | topic (1 doc) |
| `Metamerism` | 1 | **Metamerism** | topic (1 doc) |
| `Microsoft Hololens` | 1 | **Microsoft Hololens** | topic (1 doc) |
| `Moiré` | 1 | **Moiré** | topic (1 doc) |
| `Monitoring Level` | 1 | **Monitoring Level** | topic (1 doc) |
| `Motion Picture Engineering` | 1 | **Motion Picture Engineering** | topic (1 doc) |
| `Mpeg2ts` | 1 | **Mpeg2ts** | topic (1 doc) |
| `Multi-agent AI` | 1 | **Multi-agent AI** | topic (1 doc) |
| `MULTI-LABEL Text Classification` | 1 | **MULTI-LABEL Text Classification** | topic (1 doc) |
| `Multilingual Chatbots` | 1 | **Multilingual Chatbots** | topic (1 doc) |
| `Multilingual Delivery` | 1 | **Multilingual Delivery** | topic (1 doc) |
| `Multimodal AI` | 1 | **Multimodal AI** | topic (1 doc) |
| `Multispectral Scanning` | 1 | **Multispectral Scanning** | topic (1 doc) |
| `Natural Language Processing` | 1 | **Natural Language Processing** | topic (1 doc) |
| `Natural Language Processing (nlp)` | 1 | **Natural Language Processing (nlp)** | topic (1 doc) |
| `Network Control` | 1 | **Network Control** | topic (1 doc) |
| `Neural Network` | 1 | **Neural Network** | topic (1 doc) |
| `News Gathering` | 1 | **News Gathering** | topic (1 doc) |
| `News Media` | 1 | **News Media** | topic (1 doc) |
| `Next Generation Digital Cinema` | 1 | **Next Generation Digital Cinema** | topic (1 doc) |
| `NEXT-GENERATION Audio` | 1 | **NEXT-GENERATION Audio** | topic (1 doc) |
| `Next-generation-audio Nga` | 1 | **Next-generation-audio Nga** | topic (1 doc) |
| `Nhk Archives` | 1 | **Nhk Archives** | topic (1 doc) |
| `Nmos Interoperability` | 1 | **Nmos Interoperability** | topic (1 doc) |
| `Object Recognition` | 1 | **Object Recognition** | topic (1 doc) |
| `Object Tracking` | 1 | **Object Tracking** | topic (1 doc) |
| `Observer Metamerism` | 1 | **Observer Metamerism** | topic (1 doc) |
| `On-premises Datacenters` | 1 | **On-premises Datacenters** | topic (1 doc) |
| `Open Source Tools` | 1 | **Open Source Tools** | topic (1 doc) |
| `Open Standard` | 1 | **Open Standard** | topic (1 doc) |
| `Openclip` | 1 | **Openclip** | topic (1 doc) |
| `Operational Readiness` | 1 | **Operational Readiness** | topic (1 doc) |
| `Optic Flow` | 1 | **Optic Flow** | topic (1 doc) |
| `OPTO-ELECTRONIC Transfer Function (oetf)` | 1 | **OPTO-ELECTRONIC Transfer Function (oetf)** | topic (1 doc) |
| `Orthostereoscopic Imaging` | 1 | **Orthostereoscopic Imaging** | topic (1 doc) |
| `Ott Streaming` | 1 | **Ott Streaming** | topic (1 doc) |
| `Over-the-top (ott) Media Platforms` | 1 | **Over-the-top (ott) Media Platforms** | topic (1 doc) |
| `Overlays` | 1 | **Overlays** | topic (1 doc) |
| `Packet-pacing` | 1 | **Packet-pacing** | topic (1 doc) |
| `PER-TITLE Encoding` | 1 | **PER-TITLE Encoding** | topic (1 doc) |
| `Personal Data Store (pds)` | 1 | **Personal Data Store (pds)** | topic (1 doc) |
| `Phase Correction` | 1 | **Phase Correction** | topic (1 doc) |
| `Photogrammetry` | 1 | **Photogrammetry** | topic (1 doc) |
| `Picture Settings` | 1 | **Picture Settings** | topic (1 doc) |
| `Pixel Formats` | 1 | **Pixel Formats** | topic (1 doc) |
| `Polarizing` | 1 | **Polarizing** | topic (1 doc) |
| `Predictable Performance` | 1 | **Predictable Performance** | topic (1 doc) |
| `Preprocessing Acceleration` | 1 | **Preprocessing Acceleration** | topic (1 doc) |
| `Product Security` | 1 | **Product Security** | topic (1 doc) |
| `Production Sound mixer/recordist` | 1 | **Production Sound mixer/recordist** | topic (1 doc) |
| `Production Tools` | 1 | **Production Tools** | topic (1 doc) |
| `Production Workflow` | 1 | **Production Workflow** | topic (1 doc) |
| `Prompt Engineering` | 1 | **Prompt Engineering** | topic (1 doc) |
| `Psychophysical Experiment` | 1 | **Psychophysical Experiment** | topic (1 doc) |
| `Public Cloud` | 1 | **Public Cloud** | topic (1 doc) |
| `Quality Benchmarking` | 1 | **Quality Benchmarking** | topic (1 doc) |
| `Quality Of Experience (qoe)` | 1 | **Quality Of Experience (qoe)** | topic (1 doc) |
| `Quantum` | 1 | **Quantum** | topic (1 doc) |
| `Queue Buffer Management` | 1 | **Queue Buffer Management** | topic (1 doc) |
| `Radiometric Calibration` | 1 | **Radiometric Calibration** | topic (1 doc) |
| `RATE-DISTORTION Analysis` | 1 | **RATE-DISTORTION Analysis** | topic (1 doc) |
| `Rdd 50` | 1 | **Rdd 50** | topic (1 doc) |
| `REAL-TIME Broadcast Graphics` | 1 | **REAL-TIME Broadcast Graphics** | topic (1 doc) |
| `Real-time Media Workflows` | 1 | **Real-time Media Workflows** | topic (1 doc) |
| `REAL-TIME Personalization` | 1 | **REAL-TIME Personalization** | topic (1 doc) |
| `Real-time Processing` | 1 | **Real-time Processing** | topic (1 doc) |
| `REAL-TIME Video` | 1 | **REAL-TIME Video** | topic (1 doc) |
| `Reference Architecture` | 1 | **Reference Architecture** | topic (1 doc) |
| `Region Of Interest` | 1 | **Region Of Interest** | topic (1 doc) |
| `Region-of-interest Decoding` | 1 | **Region-of-interest Decoding** | topic (1 doc) |
| `Relation Extraction` | 1 | **Relation Extraction** | topic (1 doc) |
| `Reliability` | 1 | **Reliability** | topic (1 doc) |
| `Remote Shared Memory` | 1 | **Remote Shared Memory** | topic (1 doc) |
| `Reputation Attacks` | 1 | **Reputation Attacks** | topic (1 doc) |
| `Retrieval Augmented Generation` | 1 | **Retrieval Augmented Generation** | topic (1 doc) |
| `Rfc9134` | 1 | **Rfc9134** | topic (1 doc) |
| `Rgb Compression` | 1 | **Rgb Compression** | topic (1 doc) |
| `Ris-osa` | 1 | **Ris-osa** | topic (1 doc) |
| `Rosstalk` | 1 | **Rosstalk** | topic (1 doc) |
| `Rtp-real Time Transport Protocol` | 1 | **Rtp-real Time Transport Protocol** | topic (1 doc) |
| `Safe Listening` | 1 | **Safe Listening** | topic (1 doc) |
| `Sample Rate` | 1 | **Sample Rate** | topic (1 doc) |
| `Scale Out Capability` | 1 | **Scale Out Capability** | topic (1 doc) |
| `Scene Description` | 1 | **Scene Description** | topic (1 doc) |
| `Scheduling` | 1 | **Scheduling** | topic (1 doc) |
| `Security Testing` | 1 | **Security Testing** | topic (1 doc) |
| `Semantic Understanding` | 1 | **Semantic Understanding** | topic (1 doc) |
| `Service Lifecycle` | 1 | **Service Lifecycle** | topic (1 doc) |
| `Shading` | 1 | **Shading** | topic (1 doc) |
| `Shoppable Video` | 1 | **Shoppable Video** | topic (1 doc) |
| `Smpte St 2117–1` | 1 | **Smpte St 2117–1** | topic (1 doc) |
| `Smpte St2110` | 1 | **Smpte St2110** | topic (1 doc) |
| `Social Engineering` | 1 | **Social Engineering** | topic (1 doc) |
| `Social Media` | 1 | **Social Media** | topic (1 doc) |
| `Software Defined Workflows` | 1 | **Software Defined Workflows** | topic (1 doc) |
| `Software Engineering` | 1 | **Software Engineering** | topic (1 doc) |
| `Sound Exposure` | 1 | **Sound Exposure** | topic (1 doc) |
| `Sound Mitigation Specialist` | 1 | **Sound Mitigation Specialist** | topic (1 doc) |
| `Speaker Diarization` | 1 | **Speaker Diarization** | topic (1 doc) |
| `Spectral Reduction Techniques` | 1 | **Spectral Reduction Techniques** | topic (1 doc) |
| `Spectral Rendering` | 1 | **Spectral Rendering** | topic (1 doc) |
| `Speech-to-text` | 1 | **Speech-to-text** | topic (1 doc) |
| `Sports Broadcasting` | 1 | **Sports Broadcasting** | topic (1 doc) |
| `Sports Science` | 1 | **Sports Science** | topic (1 doc) |
| `Ssap Protocol` | 1 | **Ssap Protocol** | topic (1 doc) |
| `Standard Dynamic Range` | 1 | **Standard Dynamic Range** | topic (1 doc) |
| `Stateless` | 1 | **Stateless** | topic (1 doc) |
| `Static Versus Dynamic Test Materials` | 1 | **Static Versus Dynamic Test Materials** | topic (1 doc) |
| `Stream Density` | 1 | **Stream Density** | topic (1 doc) |
| `Streaming Video` | 1 | **Streaming Video** | topic (1 doc) |
| `Structured Datasets` | 1 | **Structured Datasets** | topic (1 doc) |
| `Studio Operations` | 1 | **Studio Operations** | topic (1 doc) |
| `Subjective Experiment` | 1 | **Subjective Experiment** | topic (1 doc) |
| `Sustainable Streaming` | 1 | **Sustainable Streaming** | topic (1 doc) |
| `Synchronous Ethernet` | 1 | **Synchronous Ethernet** | topic (1 doc) |
| `Synchronous Processing` | 1 | **Synchronous Processing** | topic (1 doc) |
| `Synthetic Influence` | 1 | **Synthetic Influence** | topic (1 doc) |
| `System Limitations` | 1 | **System Limitations** | topic (1 doc) |
| `System Security` | 1 | **System Security** | topic (1 doc) |
| `Systems Engineering` | 1 | **Systems Engineering** | topic (1 doc) |
| `Taxonomy Inference` | 1 | **Taxonomy Inference** | topic (1 doc) |
| `Telecom` | 1 | **Telecom** | topic (1 doc) |
| `Temporal Consistency Metrics` | 1 | **Temporal Consistency Metrics** | topic (1 doc) |
| `Text-to-speech` | 1 | **Text-to-speech** | topic (1 doc) |
| `Text-to-speech (tts)` | 1 | **Text-to-speech (tts)** | topic (1 doc) |
| `Thumbnail Extraction` | 1 | **Thumbnail Extraction** | topic (1 doc) |
| `Time Addressable Media Store` | 1 | **Time Addressable Media Store** | topic (1 doc) |
| `Time Transfer Chain` | 1 | **Time Transfer Chain** | topic (1 doc) |
| `Time-aligned Media` | 1 | **Time-aligned Media** | topic (1 doc) |
| `Timing Performance` | 1 | **Timing Performance** | topic (1 doc) |
| `Tinnitus` | 1 | **Tinnitus** | topic (1 doc) |
| `Tone Mapping` | 1 | **Tone Mapping** | topic (1 doc) |
| `TR-07` | 1 | **TR-07** | topic (1 doc) |
| `TR-08` | 1 | **TR-08** | topic (1 doc) |
| `Traditional Core Routing` | 1 | **Traditional Core Routing** | topic (1 doc) |
| `Training` | 1 | **Training** | topic (1 doc) |
| `Transfer Fabric` | 1 | **Transfer Fabric** | topic (1 doc) |
| `Tunable Bitrate` | 1 | **Tunable Bitrate** | topic (1 doc) |
| `Uhd Video` | 1 | **Uhd Video** | topic (1 doc) |
| `ULTRA-LOW Latency` | 1 | **ULTRA-LOW Latency** | topic (1 doc) |
| `Uncompressed Transport` | 1 | **Uncompressed Transport** | topic (1 doc) |
| `Unified Framework` | 1 | **Unified Framework** | topic (1 doc) |
| `Universal Percept` | 1 | **Universal Percept** | topic (1 doc) |
| `Unstructured Text` | 1 | **Unstructured Text** | topic (1 doc) |
| `USER-CENTRIC Metrics` | 1 | **USER-CENTRIC Metrics** | topic (1 doc) |
| `Versatile Video Coding` | 1 | **Versatile Video Coding** | topic (1 doc) |
| `Versatile Video Coding (vvc)` | 1 | **Versatile Video Coding (vvc)** | topic (1 doc) |
| `Vidby Ag` | 1 | **Vidby Ag** | topic (1 doc) |
| `Video Codec` | 1 | **Video Codec** | topic (1 doc) |
| `Video Codecs` | 1 | **Video Codecs** | topic (1 doc) |
| `Video Encoding Optimization` | 1 | **Video Encoding Optimization** | topic (1 doc) |
| `Video Frame Interpolation Quality` | 1 | **Video Frame Interpolation Quality** | topic (1 doc) |
| `Video Generation Models` | 1 | **Video Generation Models** | topic (1 doc) |
| `Video Monetization` | 1 | **Video Monetization** | topic (1 doc) |
| `Video Processing` | 1 | **Video Processing** | topic (1 doc) |
| `Video Quality` | 1 | **Video Quality** | topic (1 doc) |
| `Video Quality Assessment` | 1 | **Video Quality Assessment** | topic (1 doc) |
| `Video Quality Of Experience` | 1 | **Video Quality Of Experience** | topic (1 doc) |
| `Video Services Forum` | 1 | **Video Services Forum** | topic (1 doc) |
| `Video Streaming` | 1 | **Video Streaming** | topic (1 doc) |
| `Video Summarization` | 1 | **Video Summarization** | topic (1 doc) |
| `Video Switchers` | 1 | **Video Switchers** | topic (1 doc) |
| `Viewing Experience` | 1 | **Viewing Experience** | topic (1 doc) |
| `Virtual` | 1 | **Virtual** | topic (1 doc) |
| `Virtual Cameras` | 1 | **Virtual Cameras** | topic (1 doc) |
| `Virtual Machines` | 1 | **Virtual Machines** | topic (1 doc) |
| `Virtual Reality Film Production Pipeline` | 1 | **Virtual Reality Film Production Pipeline** | topic (1 doc) |
| `Virtual Sets` | 1 | **Virtual Sets** | topic (1 doc) |
| `Virtual Video Production` | 1 | **Virtual Video Production** | topic (1 doc) |
| `Visual Effects` | 1 | **Visual Effects** | topic (1 doc) |
| `Visual Quality Metric` | 1 | **Visual Quality Metric** | topic (1 doc) |
| `Voice Cloning` | 1 | **Voice Cloning** | topic (1 doc) |
| `Voice Control` | 1 | **Voice Control** | topic (1 doc) |
| `Voice Synthesizer` | 1 | **Voice Synthesizer** | topic (1 doc) |
| `Volumetric Capture` | 1 | **Volumetric Capture** | topic (1 doc) |
| `Volumetric Videos` | 1 | **Volumetric Videos** | topic (1 doc) |
| `Vulnerability Disclosure` | 1 | **Vulnerability Disclosure** | topic (1 doc) |
| `Vulnerability Management` | 1 | **Vulnerability Management** | topic (1 doc) |
| `Wcg- Wide Color Gamut` | 1 | **Wcg- Wide Color Gamut** | topic (1 doc) |
| `Websocket-based API` | 1 | **Websocket-based API** | topic (1 doc) |
| `Wide Color Volume` | 1 | **Wide Color Volume** | topic (1 doc) |
| `Workflow Integration` | 1 | **Workflow Integration** | topic (1 doc) |
