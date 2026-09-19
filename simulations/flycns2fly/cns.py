from dataclasses import dataclass, asdict, field
from textwrap import dedent
from typing import cast

from brian2 import (
    Hz,
    Network,
    NeuronGroup,
    SpikeMonitor,
    Synapses,
    mV,
    ms,
    PoissonInput,
)
from brian2.units.fundamentalunits import Quantity

from .connectome import Connectome


@dataclass(kw_only=True)
class CNSConfig:
    """Configuration for Brian2 spiking neural network simulations."""

    # ---------------------------------------------------------
    # Trials
    # ---------------------------------------------------------
    t_run: Quantity = field(
        default_factory=lambda: cast(Quantity, 1000 * ms)
    )  # duration of trial
    n_run: int = 30  # number of runs

    # ---------------------------------------------------------
    # Network Constants
    # ---------------------------------------------------------
    # Kakaria and de Bivort 2017 (https://doi.org/10.3389/fnbeh.2017.00008)
    v_0: Quantity = field(
        default_factory=lambda: cast(Quantity, -52 * mV)
    )  # resting potential
    v_rst: Quantity = field(
        default_factory=lambda: cast(Quantity, -52 * mV)
    )  # reset potential after spike
    v_th: Quantity = field(
        default_factory=lambda: cast(Quantity, -45 * mV)
    )  # threshold for spiking
    t_mbr: Quantity = field(
        default_factory=lambda: cast(Quantity, 20 * ms)
    )  # membrane time scale (capacitance * resistance)

    # Jürgensen et al (https://doi.org/10.1088/2634-4386/ac3ba6)
    tau: Quantity = field(
        default_factory=lambda: cast(Quantity, 5 * ms)
    )  # time constant

    # Lazar et al (https://doi.org/10.7554/eLife.62362)
    t_rfc: Quantity = field(
        default_factory=lambda: cast(Quantity, 2.2 * ms)
    )  # refractory period

    # Paul et al 2015 (doi: 10.3389/fncel.2015.00029)
    t_dly: Quantity = field(
        default_factory=lambda: cast(Quantity, 1.8 * ms)
    )  # delay for changes in post-synaptic neuron

    # ---------------------------------------------------------
    # Free Parameters
    # ---------------------------------------------------------
    w_syn: Quantity = field(
        default_factory=lambda: cast(Quantity, 0.275 * mV)
    )  # weight per synapse
    r_poi: Quantity = field(
        default_factory=lambda: cast(Quantity, 150 * Hz)
    )  # default rate of the Poisson inputs
    r_poi2: Quantity = field(
        default_factory=lambda: cast(Quantity, 0 * Hz)
    )  # default rate of a 2nd class of Poisson inputs
    f_poi: float = 250.0  # scaling factor for Poisson synapse

    # ---------------------------------------------------------
    # Equations and Rules
    # ---------------------------------------------------------
    eqs: str = dedent("""\
        dv/dt = (v_0 - v + g) / t_mbr : volt (unless refractory)
        dg/dt = -g / tau              : volt (unless refractory)
        rfc                           : second
    """)

    eq_th: str = "v > v_th"
    eq_rst: str = "v = v_rst; w = 0; g = 0 * mV"


class CNS:
    def __init__(self, connectome: Connectome, config: CNSConfig | None = None) -> None:
        self.cns_config = config if config is not None else CNSConfig()
        self.connectome = connectome
        self.neurons = NeuronGroup(
            N=connectome.num_neurons,
            model=self.cns_config.eqs,
            method="linear",
            threshold=self.cns_config.eq_th,
            reset=self.cns_config.eq_rst,
            refractory="rfc",  # type: ignore
            name="default_neurons",
            namespace=asdict(self.cns_config),
        )
        self.neurons.v = self.cns_config.v_0
        self.neurons.g = 0
        self.neurons.rfc = self.cns_config.t_rfc
        self.synapses = Synapses(
            self.neurons,
            self.neurons,
            "w: volt",
            on_pre="g += w",
            delay=self.cns_config.t_dly,
            name="default_synapses",
        )
        self.i_pre = self.connectome.presynaptic_indices
        self.i_post = self.connectome.postsynaptic_indices
        self.synapses.connect(i=self.i_pre, j=self.i_post)
        self.synapses.w = self.connectome.connectivity * self.cns_config.w_syn
        self.spike_monitor = SpikeMonitor(self.neurons)
        self.network = Network(
            self.neurons,
            self.synapses,
            self.spike_monitor,
        )

        self.poisson_inputs = []

    def add_poisson_inputs(
        self,
        exc: list[int],
        exc2: list[int] | None = None,
    ):
        if exc2 is None:
            exc2 = []

        for i in exc:
            p = PoissonInput(
                target=self.neurons[i],
                target_var="v",
                N=1,
                rate=self.cns_config.r_poi,
                weight=self.cns_config.w_syn * self.cns_config.f_poi,
            )
            self.neurons[i].rfc = 0 * ms
            self.poisson_inputs.append(p)
            self.network.add(p)

        for i in exc2:
            p = PoissonInput(
                target=self.neurons[i],
                target_var="v",
                N=1,
                rate=self.cns_config.r_poi2,
                weight=self.cns_config.w_syn * self.cns_config.f_poi,
            )
            self.neurons[i].rfc = 0 * ms
            self.poisson_inputs.append(p)
            self.network.add(p)

    def run(self, duration):
        self.network.run(duration)

    def reset(self) -> None:
        self.neurons.v = self.cns_config.v_0
        self.neurons.g = 0
        self.neurons.rfc = self.cns_config.t_rfc
        self.spike_monitor.reinit()

    @property
    def spike_trains(self):
        return self.spike_monitor.spike_trains()
